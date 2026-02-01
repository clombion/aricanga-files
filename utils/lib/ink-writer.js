/**
 * ink-writer.js - Apply translations to ink files
 *
 * Patches ink files with translated text while preserving:
 * - Ink syntax (tags, choice markers, diverts)
 * - Variable placeholders {var}
 * - Learning highlights ((text::source))
 * - Leading whitespace/indentation
 */

import { execSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

/**
 * Generate a timestamp string for backup filenames
 * Format: YYYY-MM-DDTHHMMSS (filesystem-safe ISO format)
 * @returns {string} Timestamp string
 */
export function generateBackupTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Find the most recent backup for a file
 * @param {string} filePath - Path to original file
 * @returns {string|null} Path to most recent backup, or null if none found
 */
export function findLatestBackup(filePath) {
  const dir = dirname(filePath);
  const base = basename(filePath);
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d{4}-\\d{2}-\\d{2}T\\d{6}\\.bak$`);

  try {
    const files = readdirSync(dir);
    const backups = files.filter((f) => pattern.test(f)).sort().reverse();
    return backups.length > 0 ? join(dir, backups[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Create a backup of a file before modifying it
 * Uses timestamp to avoid overwriting previous backups
 * @param {string} filePath - Path to file
 * @returns {string} Path to backup file
 */
export function createBackup(filePath) {
  const timestamp = generateBackupTimestamp();
  const backupPath = `${filePath}.${timestamp}.bak`;
  if (existsSync(filePath)) {
    copyFileSync(filePath, backupPath);
  }
  return backupPath;
}

/**
 * Restore a file from its backup
 * @param {string} filePath - Path to original file
 * @param {string} [backupPath] - Explicit backup path (finds latest if not provided)
 */
export function restoreBackup(filePath, backupPath) {
  const actualBackupPath = backupPath || findLatestBackup(filePath);
  if (actualBackupPath && existsSync(actualBackupPath)) {
    copyFileSync(actualBackupPath, filePath);
    unlinkSync(actualBackupPath);
  }
}

/**
 * Remove backup file after successful operation
 * @param {string} filePath - Path to original file
 * @param {string} [backupPath] - Explicit backup path (finds latest if not provided)
 */
export function cleanupBackup(filePath, backupPath) {
  const actualBackupPath = backupPath || findLatestBackup(filePath);
  if (actualBackupPath && existsSync(actualBackupPath)) {
    unlinkSync(actualBackupPath);
  }
}

/**
 * Extract the translatable portion from an ink line, preserving syntax
 * @param {string} line - Full ink line
 * @param {string} unitType - Type: 'dialogue', 'choice', 'conditional', 'sequence'
 * @returns {Object} Parsed components
 */
export function extractTranslatablePortion(line, unitType) {
  // Preserve leading whitespace
  const leadingMatch = line.match(/^(\s*)/);
  const leading = leadingMatch ? leadingMatch[1] : '';
  const trimmed = line.slice(leading.length);

  // Strip trailing tags: "Hello # speaker:Pat # time:9:00" -> "Hello", "# speaker:Pat # time:9:00"
  // Tags start with # but we need to be careful not to match # inside strings
  const tagMatch = trimmed.match(/^(.+?)\s*(#\s*\w+:.*)$/);
  const textPart = tagMatch ? tagMatch[1] : trimmed;
  const tagsPart = tagMatch ? tagMatch[2] : '';

  if (unitType === 'choice') {
    // Extract: "* [Choice text] response" or "+ [Choice text] response"
    const choiceMatch = textPart.match(/^([*+]\s*)\[([^\]]+)\](.*)$/);
    if (choiceMatch) {
      return {
        leading,
        prefix: choiceMatch[1], // "* " or "+ "
        bracketText: choiceMatch[2], // "Choice text"
        afterText: choiceMatch[3], // " response" (may be empty)
        suffix: tagsPart,
        type: 'choice',
      };
    }
  }

  if (unitType === 'conditional') {
    // Extract: "{cond: A | B | C}"
    const condMatch = textPart.match(/^\{([^:]+):([^}]+)\}$/);
    if (condMatch) {
      const condition = condMatch[1].trim();
      const variants = condMatch[2].split('|').map((v) => v.trim());
      return {
        leading,
        condition,
        variants,
        suffix: tagsPart,
        type: 'conditional',
      };
    }
  }

  if (unitType === 'sequence') {
    // Extract: "{~A|B|C}"
    const seqMatch = textPart.match(/^\{~([^}]+)\}(.*)$/);
    if (seqMatch) {
      const variants = seqMatch[1].split('|').map((v) => v.trim());
      return {
        leading,
        variants,
        afterText: seqMatch[2],
        suffix: tagsPart,
        type: 'sequence',
      };
    }
  }

  // Default: dialogue - entire text portion is translatable
  return {
    leading,
    text: textPart,
    suffix: tagsPart,
    type: 'dialogue',
  };
}

/**
 * Reconstruct an ink line with translated text
 * @param {Object} parsed - Parsed components from extractTranslatablePortion
 * @param {string|Object} translation - Translated text or variants object
 * @returns {string} Reconstructed line
 */
export function reconstructLine(parsed, translation) {
  const { leading, suffix } = parsed;
  const suffixPart = suffix ? ` ${suffix}` : '';

  if (parsed.type === 'choice') {
    // Translation should be "[Translated] Translated after" or just the bracket text
    // Handle both formats
    let bracketTrans, afterTrans;
    if (typeof translation === 'string') {
      const bracketMatch = translation.match(/^\[([^\]]+)\](.*)$/);
      if (bracketMatch) {
        bracketTrans = bracketMatch[1];
        afterTrans = bracketMatch[2];
      } else {
        // Assume it's just the bracket text
        bracketTrans = translation;
        afterTrans = parsed.afterText || '';
      }
    } else {
      bracketTrans = translation.bracketText || parsed.bracketText;
      afterTrans = translation.afterText ?? parsed.afterText;
    }
    return `${leading}${parsed.prefix}[${bracketTrans}]${afterTrans}${suffixPart}`;
  }

  if (parsed.type === 'conditional') {
    // Translation should be { variant_0: "A", variant_1: "B", ... } or array
    let variants;
    if (Array.isArray(translation)) {
      variants = translation;
    } else if (typeof translation === 'object') {
      // Convert object to array in correct order
      variants = Object.values(translation);
    } else {
      // Single string - shouldn't happen but handle gracefully
      variants = [translation];
    }
    return `${leading}{${parsed.condition}: ${variants.join(' | ')}}${suffixPart}`;
  }

  if (parsed.type === 'sequence') {
    let variants;
    if (Array.isArray(translation)) {
      variants = translation;
    } else if (typeof translation === 'object') {
      variants = Object.values(translation);
    } else {
      variants = parsed.variants; // Keep original if not provided
    }
    const afterText = parsed.afterText || '';
    return `${leading}{~${variants.join('|')}}${afterText}${suffixPart}`;
  }

  // Dialogue: simple replacement
  return `${leading}${translation}${suffixPart}`;
}

/**
 * Validate that placeholders are preserved in translation
 * @param {string} original - Original source text
 * @param {string} translation - Translated text
 * @returns {{ valid: boolean, error?: string, missing?: string[], extra?: string[] }}
 */
export function validatePlaceholders(original, translation) {
  // Extract placeholders {var} but not flow control like {not foo}
  const placeholderRegex = /\{(\w+)\}/g;
  const flowKeywords = ['not', 'and', 'or', 'true', 'false'];

  const extractPlaceholders = (text) => {
    const matches = [];
    let match;
    while ((match = placeholderRegex.exec(text)) !== null) {
      if (!flowKeywords.includes(match[1])) {
        matches.push(match[0]);
      }
    }
    return matches.sort();
  };

  const origPlaceholders = extractPlaceholders(original);
  const transPlaceholders = extractPlaceholders(translation);

  const missing = origPlaceholders.filter(
    (p) => !transPlaceholders.includes(p),
  );
  const extra = transPlaceholders.filter((p) => !origPlaceholders.includes(p));

  if (missing.length > 0 || extra.length > 0) {
    let error = 'Placeholder mismatch:';
    if (missing.length > 0) error += `\n  Missing: ${missing.join(', ')}`;
    if (extra.length > 0) error += `\n  Extra: ${extra.join(', ')}`;
    return { valid: false, error, missing, extra };
  }

  return { valid: true };
}

/**
 * Validate that learning highlights are preserved
 * @param {string} original - Original source text
 * @param {string} translation - Translated text
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateHighlights(original, translation) {
  const highlightRegex = /\(\([^)]+::[^)]+\)\)/g;

  const origHighlights = (original.match(highlightRegex) || []).sort();
  const transHighlights = (translation.match(highlightRegex) || []).sort();

  // Highlights should be identical (they contain data references)
  const missing = origHighlights.filter((h) => !transHighlights.includes(h));
  const extra = transHighlights.filter((h) => !origHighlights.includes(h));

  if (missing.length > 0 || extra.length > 0) {
    let error = 'Highlight mismatch:';
    if (missing.length > 0) error += `\n  Missing: ${missing.join(', ')}`;
    if (extra.length > 0) error += `\n  Modified: ${extra.join(', ')}`;
    return { valid: false, error };
  }

  return { valid: true };
}

/**
 * Patch a single line in an ink file
 * @param {string[]} lines - Array of file lines
 * @param {number} lineNum - 1-indexed line number
 * @param {string|Object} translation - Translated text
 * @param {Object} unit - Translation unit with type info
 * @param {Object} options - Options { force, skipValidation }
 * @returns {{ success: boolean, error?: string, warning?: string, original: string, patched: string }}
 */
export function patchLine(lines, lineNum, translation, unit, options = {}) {
  const { force = false, skipValidation = false } = options;

  // Validate line number
  if (lineNum < 1 || lineNum > lines.length) {
    return {
      success: false,
      error: `Line ${lineNum} not found (file has ${lines.length} lines).\nSource file may have changed since extraction. Re-run extract.`,
    };
  }

  const original = lines[lineNum - 1];

  // Check if source text matches (detect drift)
  if (!original.includes(unit.source) && !force) {
    return {
      success: false,
      warning: `Line ${lineNum} content changed since extraction.\n  Expected: "${unit.source}"\n  Found: "${original}"\nUse --force to override.`,
      original,
      skipped: true,
    };
  }

  // Validate placeholders and highlights unless skipped
  if (!skipValidation && typeof translation === 'string') {
    const placeholderResult = validatePlaceholders(unit.source, translation);
    if (!placeholderResult.valid) {
      return {
        success: false,
        error: `${placeholderResult.error}\nUse --skip-validation to ignore.`,
        original,
      };
    }

    const highlightResult = validateHighlights(unit.source, translation);
    if (!highlightResult.valid) {
      return {
        success: false,
        error: `${highlightResult.error}\nUse --skip-validation to ignore.`,
        original,
      };
    }
  }

  // Extract and reconstruct
  const parsed = extractTranslatablePortion(original, unit.type);
  const patched = reconstructLine(parsed, translation);

  return {
    success: true,
    original,
    patched,
  };
}

/**
 * Apply multiple patches to an ink file
 * @param {string} filePath - Path to ink file
 * @param {Array<{lineNum: number, translation: string|Object, unit: Object}>} patches
 * @param {Object} options - Options { dryRun, force, skipValidation, noBackup }
 * @returns {{ success: boolean, applied: number, skipped: number, errors: string[], warnings: string[], diff: Array }}
 */
export function applyInkPatches(filePath, patches, options = {}) {
  const { dryRun = false, noBackup = false } = options;

  // Check file exists
  if (!existsSync(filePath)) {
    return {
      success: false,
      applied: 0,
      skipped: 0,
      errors: [
        `Target file not found: ${filePath}\nRun 'mise run tl:init <locale>' to create locale files first.`,
      ],
      warnings: [],
      diff: [],
    };
  }

  // Read file
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return {
      success: false,
      applied: 0,
      skipped: 0,
      errors: [`Cannot read ${filePath}: ${err.message}`],
      warnings: [],
      diff: [],
    };
  }

  const lines = content.split('\n');
  const results = {
    success: true,
    applied: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    diff: [],
  };

  // Sort patches by line number (descending) to avoid index shifting
  const sortedPatches = [...patches].sort((a, b) => b.lineNum - a.lineNum);

  // Apply each patch
  for (const patch of sortedPatches) {
    const { lineNum, translation, unit } = patch;

    // Skip if no translation provided
    if (!translation) {
      results.warnings.push(`No translation for ${unit.id}, keeping original`);
      results.skipped++;
      continue;
    }

    const result = patchLine(lines, lineNum, translation, unit, options);

    if (result.skipped) {
      results.warnings.push(result.warning);
      results.skipped++;
      continue;
    }

    if (!result.success) {
      if (result.error) {
        results.errors.push(`${unit.id}: ${result.error}`);
      }
      results.success = false;
      continue;
    }

    // Record diff
    results.diff.push({
      lineNum,
      id: unit.id,
      original: result.original,
      patched: result.patched,
    });

    // Apply patch to lines array
    lines[lineNum - 1] = result.patched;
    results.applied++;
  }

  // Write file if not dry run and no errors
  if (!dryRun && results.success && results.applied > 0) {
    // Create backup
    let backupPath = null;
    if (!noBackup) {
      try {
        backupPath = createBackup(filePath);
      } catch (err) {
        return {
          ...results,
          success: false,
          errors: [...results.errors, `Cannot create backup: ${err.message}`],
        };
      }
    }

    // Write patched content
    try {
      writeFileSync(filePath, lines.join('\n'));
    } catch (err) {
      // Restore backup on write failure
      if (!noBackup) {
        restoreBackup(filePath, backupPath);
      }
      return {
        ...results,
        success: false,
        errors: [...results.errors, `Cannot write ${filePath}: ${err.message}`],
      };
    }

    // Clean up backup on success
    if (!noBackup) {
      cleanupBackup(filePath, backupPath);
    }
  }

  return results;
}

/**
 * Validate an ink file compiles correctly using inklecate
 * @param {string} filePath - Path to ink file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateInkFile(filePath) {
  if (!existsSync(filePath)) {
    return { valid: false, error: `File not found: ${filePath}` };
  }

  try {
    // Use inklecate to validate the file
    // -o /dev/null to discard output, we just want to check for errors
    execSync(`inklecate -o /dev/null "${filePath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { valid: true };
  } catch (err) {
    // inklecate exits with non-zero on errors
    const stderr = err.stderr || err.message;
    // Extract the relevant error message
    const errorLines = stderr
      .split('\n')
      .filter((line) => line.includes('ERROR') || line.includes('error'))
      .join('\n');
    return {
      valid: false,
      error: errorLines || stderr.slice(0, 500),
    };
  }
}
