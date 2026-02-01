/**
 * Ink Writer Unit Tests
 *
 * Tests for utils/lib/ink-writer.js - the library that patches
 * translated text into ink files.
 *
 * Original: ~28 tests, 514 lines
 * Consolidated: ~15 tests, ~300 lines (same coverage)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Import functions from ink-writer (dynamic import since it's ES module)
let inkWriter: typeof import('../../../../utils/lib/ink-writer.js');

beforeAll(async () => {
  inkWriter = await import('../../../../utils/lib/ink-writer.js');
});

function getTmpDir() {
  const dir = join(process.cwd(), 'tests', '.tmp-ink-writer', randomUUID());
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ============================================================================
// extractTranslatablePortion - parameterized extraction tests
// ============================================================================
describe('extractTranslatablePortion', () => {
  const EXTRACT_CASES = [
    {
      name: 'dialogue - simple line',
      input: 'Hello world',
      type: 'dialogue',
      expected: { type: 'dialogue', text: 'Hello world', leading: '', suffix: '' },
    },
    {
      name: 'dialogue - preserves leading whitespace',
      input: '    Indented text',
      type: 'dialogue',
      expected: { type: 'dialogue', leading: '    ', text: 'Indented text' },
    },
    {
      name: 'dialogue - strips trailing tags',
      input: 'Hello there # speaker:Pat # time:9:00',
      type: 'dialogue',
      expected: { text: 'Hello there', suffix: '# speaker:Pat # time:9:00' },
    },
    {
      name: 'choice - extracts bracket text',
      input: '* [Choose this] Response text',
      type: 'choice',
      expected: { type: 'choice', prefix: '* ', bracketText: 'Choose this', afterText: ' Response text' },
    },
    {
      name: 'choice - sticky with tags',
      input: '+ [Sticky choice] Response # tone:friendly',
      type: 'choice',
      expected: { prefix: '+ ', bracketText: 'Sticky choice', afterText: ' Response', suffix: '# tone:friendly' },
    },
    {
      name: 'conditional - extracts variants',
      input: '{gender: He | She | They}',
      type: 'conditional',
      expected: { type: 'conditional', condition: 'gender', variants: ['He', 'She', 'They'] },
    },
    {
      name: 'sequence - extracts variants with afterText',
      input: '{~Hello|Hi|Hey} there!',
      type: 'sequence',
      expected: { type: 'sequence', variants: ['Hello', 'Hi', 'Hey'], afterText: ' there!' },
    },
  ] as const;

  for (const { name, input, type, expected } of EXTRACT_CASES) {
    it(name, () => {
      const result = inkWriter.extractTranslatablePortion(input, type);
      for (const [key, value] of Object.entries(expected)) {
        expect(result[key], `${key} mismatch`).toEqual(value);
      }
    });
  }
});

// ============================================================================
// reconstructLine - parameterized reconstruction tests
// ============================================================================
describe('reconstructLine', () => {
  const RECONSTRUCT_CASES = [
    {
      name: 'dialogue - simple',
      parsed: { leading: '', text: 'Hello', suffix: '', type: 'dialogue' as const },
      translation: 'Bonjour',
      expected: 'Bonjour',
    },
    {
      name: 'dialogue - preserves tags',
      parsed: { leading: '', text: 'Hello', suffix: '# speaker:Pat', type: 'dialogue' as const },
      translation: 'Bonjour',
      expected: 'Bonjour # speaker:Pat',
    },
    {
      name: 'dialogue - preserves indentation',
      parsed: { leading: '    ', text: 'Hello', suffix: '', type: 'dialogue' as const },
      translation: 'Bonjour',
      expected: '    Bonjour',
    },
    {
      name: 'choice - with bracket text',
      parsed: { leading: '', prefix: '* ', bracketText: 'Choose', afterText: ' Response', suffix: '', type: 'choice' as const },
      translation: '[Choisir] Réponse',
      expected: '* [Choisir] Réponse',
    },
    {
      name: 'conditional - translated variants',
      parsed: { leading: '', condition: 'gender', variants: ['He', 'She', 'They'], suffix: '', type: 'conditional' as const },
      translation: ['Il', 'Elle', 'Iel'],
      expected: '{gender: Il | Elle | Iel}',
    },
    {
      name: 'sequence - translated variants',
      parsed: { leading: '', variants: ['Hello', 'Hi', 'Hey'], afterText: ' there!', suffix: '', type: 'sequence' as const },
      translation: ['Bonjour', 'Salut', 'Coucou'],
      expected: '{~Bonjour|Salut|Coucou} there!',
    },
  ] as const;

  for (const { name, parsed, translation, expected } of RECONSTRUCT_CASES) {
    it(name, () => {
      const result = inkWriter.reconstructLine(parsed as any, translation as any);
      expect(result).toBe(expected);
    });
  }
});

// ============================================================================
// Validation tests - consolidated placeholder and highlight checks
// ============================================================================
describe('validatePlaceholders', () => {
  const PLACEHOLDER_CASES = [
    { name: 'passes when preserved', source: 'Hello {name}, {count} messages', target: 'Bonjour {name}, {count} messages', valid: true },
    { name: 'fails when removed', source: 'Hello {name}, {count}', target: 'Bonjour', valid: false, missing: ['{name}', '{count}'] },
    { name: 'fails when renamed', source: 'Hello {name}', target: 'Bonjour {nom}', valid: false, missing: ['{name}'], extra: ['{nom}'] },
    { name: 'ignores flow control {not}', source: '{not done} Hello {name}', target: '{not done} Bonjour {name}', valid: true },
    { name: 'ignores {and} {or} {true} {false}', source: '{and} {or} {true} {false} Hello', target: '{and} {or} {true} {false} Bonjour', valid: true },
  ] as const;

  for (const { name, source, target, valid, missing, extra } of PLACEHOLDER_CASES) {
    it(name, () => {
      const result = inkWriter.validatePlaceholders(source, target);
      expect(result.valid).toBe(valid);
      if (missing) expect(result.missing).toEqual(expect.arrayContaining(missing));
      if (extra) expect(result.extra).toEqual(expect.arrayContaining(extra));
    });
  }
});

describe('validateHighlights', () => {
  const HIGHLIGHT_CASES = [
    { name: 'passes when preserved', source: 'Learn about ((democracy::civics))', target: 'Apprenez sur ((democracy::civics))', valid: true },
    { name: 'fails when removed', source: 'Learn about ((democracy::civics))', target: 'Apprenez sur democracy', valid: false },
    { name: 'fails when modified', source: 'Learn about ((democracy::civics))', target: 'Apprenez sur ((démocratie::civics))', valid: false },
    { name: 'passes with no highlights', source: 'Hello world', target: 'Bonjour monde', valid: true },
  ] as const;

  for (const { name, source, target, valid } of HIGHLIGHT_CASES) {
    it(name, () => {
      const result = inkWriter.validateHighlights(source, target);
      expect(result.valid).toBe(valid);
    });
  }
});

// ============================================================================
// patchLine tests - consolidated line patching scenarios
// ============================================================================
describe('patchLine', () => {
  it('patches successfully and handles errors', () => {
    // Success case
    const lines = ['Hello world', 'Second line'];
    const unit = { id: 'test.line_1', source: 'Hello world', type: 'dialogue' };
    const success = inkWriter.patchLine(lines, 1, 'Bonjour monde', unit);
    expect(success.success).toBe(true);
    expect(success.original).toBe('Hello world');
    expect(success.patched).toBe('Bonjour monde');

    // Out of range
    const outOfRange = inkWriter.patchLine(['One'], 99, 'X', { id: 'x', source: 'One', type: 'dialogue' });
    expect(outOfRange.success).toBe(false);
    expect(outOfRange.error).toContain('Line 99 not found');

    // Source mismatch - skipped
    const mismatch = inkWriter.patchLine(['Changed'], 1, 'X', { id: 'x', source: 'Original', type: 'dialogue' });
    expect(mismatch.success).toBe(false);
    expect(mismatch.skipped).toBe(true);
    expect(mismatch.warning).toContain('content changed');

    // Source mismatch - forced
    const forced = inkWriter.patchLine(['Changed'], 1, 'Translated', { id: 'x', source: 'Original', type: 'dialogue' }, { force: true });
    expect(forced.success).toBe(true);

    // Placeholder mismatch
    const phMismatch = inkWriter.patchLine(['Hello {name}'], 1, 'Bonjour {nom}', { id: 'x', source: 'Hello {name}', type: 'dialogue' });
    expect(phMismatch.success).toBe(false);
    expect(phMismatch.error).toContain('Placeholder mismatch');

    // Placeholder mismatch - skip validation
    const phSkip = inkWriter.patchLine(['Hello {name}'], 1, 'Bonjour {nom}', { id: 'x', source: 'Hello {name}', type: 'dialogue' }, { skipValidation: true });
    expect(phSkip.success).toBe(true);
  });
});

// ============================================================================
// Backup mechanism tests
// ============================================================================
describe('Backup mechanism', () => {
  it('creates timestamped backups, restores, and cleans up', () => {
    const tmpDir = getTmpDir();
    const filePath = join(tmpDir, 'test.ink');
    writeFileSync(filePath, 'Original content');

    // Create backup - should have timestamp in path
    const backupPath = inkWriter.createBackup(filePath);
    expect(backupPath).toMatch(/test\.ink\.\d{4}-\d{2}-\d{2}T\d{6}\.bak$/);
    expect(existsSync(backupPath)).toBe(true);
    expect(readFileSync(backupPath, 'utf-8')).toBe('Original content');

    // Overwrite and restore (with explicit path)
    writeFileSync(filePath, 'Modified');
    inkWriter.restoreBackup(filePath, backupPath);
    expect(readFileSync(filePath, 'utf-8')).toBe('Original content');
    expect(existsSync(backupPath)).toBe(false);

    // Cleanup (finds latest backup automatically)
    writeFileSync(filePath, 'New');
    const backupPath2 = inkWriter.createBackup(filePath);
    expect(existsSync(backupPath2)).toBe(true);
    inkWriter.cleanupBackup(filePath, backupPath2);
    expect(existsSync(backupPath2)).toBe(false);
    expect(existsSync(filePath)).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('preserves previous backups (no overwrite)', () => {
    const tmpDir = getTmpDir();
    const filePath = join(tmpDir, 'test.ink');

    // Create first version and backup
    writeFileSync(filePath, 'Version 1');
    const backup1 = inkWriter.createBackup(filePath);

    // Wait 1 second to ensure different timestamp
    const waitUntil = Date.now() + 1000;
    while (Date.now() < waitUntil) {
      // busy wait
    }

    // Create second version and backup
    writeFileSync(filePath, 'Version 2');
    const backup2 = inkWriter.createBackup(filePath);

    // Both backups should exist with different paths
    expect(backup1).not.toBe(backup2);
    expect(existsSync(backup1)).toBe(true);
    expect(existsSync(backup2)).toBe(true);
    expect(readFileSync(backup1, 'utf-8')).toBe('Version 1');
    expect(readFileSync(backup2, 'utf-8')).toBe('Version 2');

    // findLatestBackup should return the most recent one
    const latest = inkWriter.findLatestBackup(filePath);
    expect(latest).toBe(backup2);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('findLatestBackup returns null when no backups exist', () => {
    const tmpDir = getTmpDir();
    const filePath = join(tmpDir, 'no-backup.ink');
    writeFileSync(filePath, 'Content');

    expect(inkWriter.findLatestBackup(filePath)).toBeNull();

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ============================================================================
// applyInkPatches tests - consolidated patching scenarios
// ============================================================================
describe('applyInkPatches', () => {
  it('applies multiple patches correctly', () => {
    const tmpDir = getTmpDir();
    const filePath = join(tmpDir, 'multi.ink');
    writeFileSync(filePath, 'Line one\nLine two\nLine three');

    const patches = [
      { lineNum: 1, translation: 'Ligne un', unit: { id: 'l1', source: 'Line one', type: 'dialogue' } },
      { lineNum: 3, translation: 'Ligne trois', unit: { id: 'l3', source: 'Line three', type: 'dialogue' } },
    ];

    const result = inkWriter.applyInkPatches(filePath, patches, { noBackup: true });

    expect(result.success).toBe(true);
    expect(result.applied).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(readFileSync(filePath, 'utf-8')).toBe('Ligne un\nLine two\nLigne trois');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('--dry-run shows diff without modifying', () => {
    const tmpDir = getTmpDir();
    const filePath = join(tmpDir, 'dryrun.ink');
    writeFileSync(filePath, 'Original line');

    const patches = [
      { lineNum: 1, translation: 'Translated', unit: { id: 'l1', source: 'Original line', type: 'dialogue' } },
    ];

    const result = inkWriter.applyInkPatches(filePath, patches, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.diff[0]).toMatchObject({ original: 'Original line', patched: 'Translated' });
    expect(readFileSync(filePath, 'utf-8')).toBe('Original line'); // Unchanged

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles missing files and missing translations', () => {
    // Missing file
    const missingResult = inkWriter.applyInkPatches('/nonexistent/file.ink', [], {});
    expect(missingResult.success).toBe(false);
    expect(missingResult.errors[0]).toContain('Target file not found');

    // Missing translation
    const tmpDir = getTmpDir();
    const filePath = join(tmpDir, 'missing.ink');
    writeFileSync(filePath, 'Hello');

    const patches = [
      { lineNum: 1, translation: null, unit: { id: 'l1', source: 'Hello', type: 'dialogue' } },
    ];

    const result = inkWriter.applyInkPatches(filePath, patches, { noBackup: true });
    expect(result.skipped).toBe(1);
    expect(result.warnings[0]).toContain('No translation');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('backup behavior', () => {
    const tmpDir = getTmpDir();
    const filePath = join(tmpDir, 'backup-test.ink');
    writeFileSync(filePath, 'Original');

    const patches = [
      { lineNum: 1, translation: 'Modified', unit: { id: 'l1', source: 'Original', type: 'dialogue' } },
    ];

    // Default: creates and cleans up backup (no .bak files should remain)
    inkWriter.applyInkPatches(filePath, patches, {});
    const bakFiles = readdirSync(tmpDir).filter((f) => f.endsWith('.bak'));
    expect(bakFiles).toHaveLength(0);
    expect(readFileSync(filePath, 'utf-8')).toBe('Modified');

    // Reset and test --no-backup
    writeFileSync(filePath, 'Original');
    inkWriter.applyInkPatches(filePath, patches, { noBackup: true });
    expect(readFileSync(filePath, 'utf-8')).toBe('Modified');

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ============================================================================
// validateInkFile tests
// ============================================================================
describe('validateInkFile', () => {
  it('validates ink syntax', () => {
    const tmpDir = getTmpDir();

    // Valid ink
    const validPath = join(tmpDir, 'valid.ink');
    writeFileSync(validPath, '=== start ===\nHello world\n-> END');
    expect(inkWriter.validateInkFile(validPath).valid).toBe(true);

    // Invalid ink
    const brokenPath = join(tmpDir, 'broken.ink');
    writeFileSync(brokenPath, '=== start ===\n-> nonexistent_knot');
    const brokenResult = inkWriter.validateInkFile(brokenPath);
    expect(brokenResult.valid).toBe(false);
    expect(brokenResult.error).toBeDefined();

    // Nonexistent file
    const nonexistent = inkWriter.validateInkFile('/nonexistent/file.ink');
    expect(nonexistent.valid).toBe(false);
    expect(nonexistent.error).toContain('File not found');

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
