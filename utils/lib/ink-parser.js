/**
 * ink-parser.js - Extract translatable strings from ink narrative files
 *
 * Extracts:
 * - Dialogue text (plain lines)
 * - Choice text (content in brackets [text])
 * - Learning highlights ((text::source)) - preserved structure
 * - Variable placeholders {var} - marked for preservation
 * - Conditional text variants - all branches extracted
 *
 * Skips:
 * - Comments (//)
 * - Tags (#)
 * - Logic (~)
 * - Control flow (->)
 * - Pure conditionals (flow control only)
 */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Get preceding dialogue lines for context
 * @param {Array<string>} lines - All lines in file
 * @param {number} currentIndex - Current line index
 * @param {number} count - Number of preceding lines to get
 * @returns {Array<string>}
 */
function getPrecedingLines(lines, currentIndex, count = 2) {
  const preceding = [];
  for (let i = currentIndex - 1; i >= 0 && preceding.length < count; i--) {
    const line = lines[i].trim();
    // Skip structural elements, get dialogue/choice content
    if (
      line &&
      !line.startsWith('===') &&
      !line.startsWith('=') &&
      !line.startsWith('#') &&
      !line.startsWith('~') &&
      !line.startsWith('->') &&
      !line.startsWith('//') &&
      !line.startsWith('INCLUDE ') &&
      line !== '}'
    ) {
      // Clean choice markers for context
      const cleaned = line.replace(/^[*+]\s*\[/, '[');
      preceding.unshift(cleaned);
    }
  }
  return preceding;
}

/**
 * Parse a single ink file and extract translatable strings
 * @param {string} filePath - Path to .ink file
 * @param {string} locale - Locale code (e.g., 'en', 'fr')
 * @returns {Array<TranslationUnit>}
 */
export function parseInkFile(filePath, locale) {
  const content = readFileSync(filePath, 'utf-8');
  const fileName = basename(filePath);
  const lines = content.split('\n');

  const units = [];
  let currentKnot = null;
  let currentStitch = null;
  let currentSpeaker = null;
  let currentScene = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Track knot (=== name ===)
    const knotMatch = trimmed.match(/^===\s*(\w+)\s*===$/);
    if (knotMatch) {
      currentKnot = knotMatch[1];
      currentStitch = null;
      currentSpeaker = null;
      continue;
    }

    // Track stitch (= name)
    const stitchMatch = trimmed.match(/^=\s*(\w+)\s*$/);
    if (stitchMatch) {
      currentStitch = stitchMatch[1];
      continue;
    }

    // Track speaker from tags
    const speakerMatch = trimmed.match(/^#\s*speaker:\s*(.+)$/);
    if (speakerMatch) {
      currentSpeaker = speakerMatch[1].trim();
      continue;
    }

    // Track scene description from tags
    const sceneMatch = trimmed.match(/^#\s*scene:\s*(.+)$/);
    if (sceneMatch) {
      currentScene = sceneMatch[1].trim();
      continue;
    }

    // Skip comments, tags, logic, diverts, includes
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('~') ||
      trimmed.startsWith('->') ||
      trimmed.startsWith('INCLUDE ')
    ) {
      continue;
    }

    // Skip standalone closing braces
    if (trimmed === '}') {
      continue;
    }

    // Skip pure conditional/flow control blocks
    // These patterns are flow control, not translatable text:
    // {not foo:, {foo and bar:, {foo == 1:, {foo:, etc.
    if (trimmed.match(/^\{[^{}]+:\s*$/)) {
      continue;
    }

    // Skip conditionals that contain only diverts
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1);
      // If it's purely flow control (contains -> and no actual text after colon)
      if (inner.includes('->') && !inner.match(/:\s*[^->]+/)) {
        continue;
      }
      // If it's a simple conditional check like {foo == 1: -> bar}
      if (inner.match(/^[^:]+:\s*->/)) {
        continue;
      }
    }

    // Handle choice text: * [text] or + [text]
    const choiceMatch = trimmed.match(/^[*+]\s*\[([^\]]+)\]/);
    if (choiceMatch) {
      const choiceText = choiceMatch[1].trim();
      if (choiceText && !isOnlyWhitespace(choiceText)) {
        units.push(
          createUnit({
            text: choiceText,
            type: 'choice',
            file: fileName,
            line: lineNum,
            knot: currentKnot,
            stitch: currentStitch,
            speaker: currentSpeaker,
            scene: currentScene,
            preceding: getPrecedingLines(lines, i),
            locale,
          }),
        );
      }
      // Check if there's text after the choice brackets
      const afterChoice = trimmed.slice(trimmed.indexOf(']') + 1).trim();
      if (afterChoice && !afterChoice.startsWith('->')) {
        const parsed = parseTextContent(afterChoice);
        if (parsed.hasContent) {
          units.push(
            createUnit({
              text: parsed.text,
              type: 'dialogue',
              file: fileName,
              line: lineNum,
              knot: currentKnot,
              stitch: currentStitch,
              speaker: currentSpeaker,
              scene: currentScene,
              preceding: getPrecedingLines(lines, i),
              locale,
              placeholders: parsed.placeholders,
              highlights: parsed.highlights,
            }),
          );
        }
      }
      continue;
    }

    // Skip choice markers without brackets
    if (trimmed.match(/^[*+]\s*$/)) {
      continue;
    }

    // Handle inline conditionals with text: {condition: text | text | text}
    const inlineCondMatch = trimmed.match(/^\{([^{}:]+):([^{}]+)\}$/);
    if (inlineCondMatch) {
      const condition = inlineCondMatch[1].trim();
      const branches = inlineCondMatch[2].split('|').map((b) => b.trim());

      // If branches contain translatable text (not just diverts)
      const textBranches = branches.filter((b) => !b.startsWith('->') && b);
      if (textBranches.length > 0) {
        units.push(
          createConditionalUnit({
            condition,
            variants: branches,
            file: fileName,
            line: lineNum,
            knot: currentKnot,
            stitch: currentStitch,
            speaker: currentSpeaker,
            scene: currentScene,
            preceding: getPrecedingLines(lines, i),
            locale,
          }),
        );
      }
      continue;
    }

    // Handle sequence text: {~First|Second|Third}
    const sequenceMatch = trimmed.match(/^\{~([^{}]+)\}(.*)$/);
    if (sequenceMatch) {
      const variants = sequenceMatch[1].split('|').map((v) => v.trim());

      units.push(
        createUnit({
          text: trimmed,
          type: 'sequence',
          file: fileName,
          line: lineNum,
          knot: currentKnot,
          stitch: currentStitch,
          speaker: currentSpeaker,
          scene: currentScene,
          preceding: getPrecedingLines(lines, i),
          locale,
          variants,
        }),
      );
      continue;
    }

    // Handle regular dialogue text
    const parsed = parseTextContent(trimmed);
    if (parsed.hasContent) {
      units.push(
        createUnit({
          text: parsed.text,
          type: 'dialogue',
          file: fileName,
          line: lineNum,
          knot: currentKnot,
          stitch: currentStitch,
          speaker: currentSpeaker,
          scene: currentScene,
          preceding: getPrecedingLines(lines, i),
          locale,
          placeholders: parsed.placeholders,
          highlights: parsed.highlights,
        }),
      );
    }
  }

  return units;
}

/**
 * Parse text content for placeholders and learning highlights
 * @param {string} text - Raw text content
 * @returns {{text: string, hasContent: boolean, placeholders: Object, highlights: Array}}
 */
function parseTextContent(text) {
  // Skip if it looks like pure logic
  if (text.match(/^[~\->]/)) {
    return { text: '', hasContent: false, placeholders: {}, highlights: [] };
  }

  const placeholders = {};
  const highlights = [];

  // Extract learning highlights ((text::source))
  const highlightRegex = /\(\(([^:]+)::([^)]+)\)\)/g;
  let match;
  while ((match = highlightRegex.exec(text)) !== null) {
    highlights.push({
      full: match[0],
      display: match[1],
      source: match[2],
    });
  }

  // Extract variable placeholders {var}
  // Skip conditionals like {not foo} or {foo == bar}
  const varRegex = /\{(\w+)\}/g;
  while ((match = varRegex.exec(text)) !== null) {
    const varName = match[1];
    // Skip flow control keywords
    if (!['not', 'and', 'or', 'true', 'false'].includes(varName)) {
      placeholders[varName] = match[0];
    }
  }

  // Check if this has any actual translatable content
  // Remove highlights and placeholders temporarily
  let cleanText = text;
  for (const h of highlights) {
    cleanText = cleanText.replace(h.full, '');
  }
  for (const p of Object.values(placeholders)) {
    cleanText = cleanText.replace(p, '');
  }

  const hasContent = cleanText.trim().length > 0 || highlights.length > 0;

  return { text, hasContent, placeholders, highlights };
}

/**
 * Create a translation unit ID
 * @param {Object} params
 * @returns {string}
 */
function createId({ knot, stitch, line, type }) {
  const parts = [knot || 'global'];
  if (stitch) parts.push(stitch);
  parts.push(`line_${line}`);
  if (type !== 'dialogue') parts.push(type);
  return parts.join('.');
}

/**
 * Create a standard translation unit
 * @param {Object} params
 * @returns {TranslationUnit}
 */
function createUnit({
  text,
  type,
  file,
  line,
  knot,
  stitch,
  speaker,
  scene,
  preceding,
  locale,
  placeholders = {},
  highlights = [],
  variants = null,
}) {
  const unit = {
    id: createId({ knot, stitch, line, type }),
    type,
    source: text,
    file,
    line,
    locale,
    context: buildContext({ knot, stitch, speaker }),
  };

  // Add speaker for voice matching
  if (speaker) {
    unit.speaker = speaker;
  }

  // Add scene description for context
  if (scene) {
    unit.scene = scene;
  }

  // Add preceding dialogue lines for context
  if (preceding?.length > 0) {
    unit.preceding = preceding;
  }

  if (Object.keys(placeholders).length > 0) {
    unit.placeholders = placeholders;
  }

  if (highlights.length > 0) {
    unit.highlights = highlights;
  }

  if (variants) {
    unit.variants = variants;
  }

  return unit;
}

/**
 * Create a conditional translation unit
 * @param {Object} params
 * @returns {TranslationUnit}
 */
function createConditionalUnit({
  condition,
  variants,
  file,
  line,
  knot,
  stitch,
  speaker,
  scene,
  preceding,
  locale,
}) {
  const unit = {
    id: createId({ knot, stitch, line, type: 'conditional' }),
    type: 'conditional',
    condition,
    variants: variants.reduce((acc, v, i) => {
      // Try to infer variant keys from common patterns
      if (condition.includes('player_gender')) {
        const keys = ['male', 'female', 'else'];
        acc[keys[i] || `variant_${i}`] = v;
      } else {
        acc[`variant_${i}`] = v;
      }
      return acc;
    }, {}),
    file,
    line,
    locale,
    context: buildContext({ knot, stitch, speaker }),
  };

  if (speaker) {
    unit.speaker = speaker;
  }

  if (scene) {
    unit.scene = scene;
  }

  if (preceding?.length > 0) {
    unit.preceding = preceding;
  }

  return unit;
}

/**
 * Build context string
 * @param {Object} params
 * @returns {string}
 */
function buildContext({ knot, stitch, speaker }) {
  const parts = [];
  if (speaker) parts.push(`speaker: ${speaker}`);
  if (knot) parts.push(`knot: ${knot}`);
  if (stitch) parts.push(`stitch: ${stitch}`);
  return parts.join(', ');
}

/**
 * Check if string is only whitespace
 * @param {string} str
 * @returns {boolean}
 */
function isOnlyWhitespace(str) {
  return !str || str.trim().length === 0;
}

/**
 * Parse all ink files in a locale directory
 * @param {string} inkDir - Path to locale ink directory (e.g., src/experiences/{impl}/ink/en)
 * @param {string} locale - Locale code
 * @returns {Array<TranslationUnit>}
 */
export function parseLocaleInkFiles(inkDir, locale) {
  const allUnits = [];

  // Parse main file
  const mainFile = join(inkDir, `main.${locale}.ink`);
  try {
    allUnits.push(...parseInkFile(mainFile, locale));
  } catch (_e) {
    // Main file might not exist
  }

  // Parse chat files
  const chatsDir = join(inkDir, 'chats');
  try {
    const chatFiles = readdirSync(chatsDir).filter((f) => f.endsWith('.ink'));
    for (const file of chatFiles) {
      allUnits.push(...parseInkFile(join(chatsDir, file), locale));
    }
  } catch (_e) {
    // Chats dir might not exist
  }

  return allUnits;
}

/**
 * Generate a hash for a string (for change detection)
 * @param {string} str
 * @returns {string}
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * @typedef {Object} TranslationUnit
 * @property {string} id - Unique identifier (knot.stitch.line_N.type)
 * @property {'dialogue'|'choice'|'conditional'|'sequence'} type
 * @property {string} source - Original text
 * @property {string} file - Source filename
 * @property {number} line - Line number
 * @property {string} locale - Source locale code
 * @property {string} context - Context string (speaker, knot, stitch)
 * @property {Object} [placeholders] - Variable placeholders {name: {name}}
 * @property {Array} [highlights] - Learning highlights
 * @property {Object} [variants] - Conditional/sequence variants
 * @property {string} [condition] - Condition expression (for conditionals)
 */
