/**
 * Translation CLI Contract Tests
 *
 * Validates that the translation CLI commands work correctly.
 * Consolidated with parameterized tests to reduce duplication.
 *
 * Original: ~70 tests, 1185 lines
 * Consolidated: ~35 tests, ~450 lines (same coverage)
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { describe, it, expect } from 'vitest';
import { getLocalePath } from '../locale-config';

// Use unique directory per test to avoid race conditions with parallel execution
function getTmpDir() {
  const dir = join(process.cwd(), 'tests', '.tmp-translation-cli', randomUUID());
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ============================================================================
// Parameterized Help Tests - consolidated from 8 separate tests
// ============================================================================
const HELP_TEST_CASES = [
  { cmd: 'extract', required: ['extract', '--locale', '--format', 'EXAMPLES'] },
  { cmd: 'validate', required: ['validate', '--variables', '--length', '--constraints'] },
  { cmd: 'init', required: ['init', '--source', '--name', 'CREATES'] },
  { cmd: 'import', required: ['import', '--locale', '--format', '--dry-run', '--force'] },
  { cmd: 'status', required: ['--check', 'CI mode'] },
  { cmd: 'check', required: ['check', 'Missing config keys', 'Ink file'] },
  { cmd: 'translate', required: ['translate', '--provider', '--dry-run', 'ANTHROPIC_API_KEY', 'fake'] },
  { cmd: 'names', required: ['names', '--context', '--locale', '--provider'] },
] as const;

describe('CLI Help Output', () => {
  for (const { cmd, required } of HELP_TEST_CASES) {
    it(`${cmd} --help shows required options`, () => {
      const output = execSync(
        `node experiences/aricanga/utils/translation/cli.js ${cmd} --help`,
        { encoding: 'utf-8' }
      );
      for (const text of required) {
        expect(output).toContain(text);
      }
    });
  }
});

// ============================================================================
// Extract Command Tests
// ============================================================================
describe('Extract Command', () => {
  it('produces valid JSON with metadata and strings', () => {
    const output = execSync(
      'node experiences/aricanga/utils/translation/cli.js extract -l fr -f json',
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(output);

    expect(data.metadata).toMatchObject({ source: 'en', target: 'fr' });
    expect(data.metadata.count).toBeGreaterThan(0);
    expect(data.strings.length).toBeGreaterThan(0);

    // Verify string structure
    for (const str of data.strings.slice(0, 5)) {
      expect(str).toHaveProperty('id');
      expect(str).toHaveProperty('source');
      expect(str).toHaveProperty('type');
    }
  });

  it('produces valid prompt format with markdown', () => {
    const output = execSync(
      'node experiences/aricanga/utils/translation/cli.js extract -l fr -f prompt',
      { encoding: 'utf-8' }
    );

    expect(output).toContain('# Translation: EN -> FR');
    expect(output).toContain('```json');
    expect(output).toContain('"items"');
  });

  it('--scope filters by type', () => {
    const configData = JSON.parse(execSync(
      'node experiences/aricanga/utils/translation/cli.js extract -l fr -f json --scope config',
      { encoding: 'utf-8' }
    ));
    const inkData = JSON.parse(execSync(
      'node experiences/aricanga/utils/translation/cli.js extract -l fr -f json --scope ink',
      { encoding: 'utf-8' }
    ));

    // Config strings all have config. prefix
    for (const str of configData.strings) {
      expect(str.id.startsWith('config.')).toBe(true);
      expect(str.type).toBe('config');
    }

    // Ink strings have dialogue type
    const types = new Set(inkData.strings.map((s: { type: string }) => s.type));
    expect(types.has('dialogue')).toBe(true);
  });

  it('preserves placeholders, highlights, and constraints', () => {
    const data = JSON.parse(execSync(
      'node experiences/aricanga/utils/translation/cli.js extract -l fr -f json',
      { encoding: 'utf-8' }
    ));

    // Placeholders
    const withPlaceholders = data.strings.filter(
      (s: { placeholders?: Record<string, string> }) =>
        s.placeholders && Object.keys(s.placeholders).length > 0
    );
    expect(withPlaceholders.length).toBeGreaterThan(0);
    for (const str of withPlaceholders) {
      for (const ph of Object.keys(str.placeholders)) {
        expect(str.source).toContain(`{${ph}}`);
      }
    }

    // Highlights
    const withHighlights = data.strings.filter(
      (s: { highlights?: Array<{ full: string }> }) =>
        s.highlights && s.highlights.length > 0
    );
    expect(withHighlights.length).toBeGreaterThan(0);
    for (const str of withHighlights) {
      for (const h of str.highlights) {
        expect(h.full).toMatch(/\(\([^)]+::[^)]+\)\)/);
      }
    }

    // Constraints (config scope)
    const configData = JSON.parse(execSync(
      'node experiences/aricanga/utils/translation/cli.js extract -l fr -f json --scope config',
      { encoding: 'utf-8' }
    ));
    const withConstraints = configData.strings.filter(
      (s: { constraints?: { maxLength: number } }) => s.constraints
    );
    expect(withConstraints.length).toBeGreaterThan(0);
    for (const str of withConstraints) {
      expect(str.constraints.maxLength).toBeGreaterThan(0);
      expect(str.constraints.uiElement).toBeDefined();
    }
  });
});

// ============================================================================
// Init Command Tests
// ============================================================================
describe('Init Command', () => {
  it('auto-detects known locale names', () => {
    const output = execSync(
      'node experiences/aricanga/utils/translation/cli.js init es --dry-run',
      { encoding: 'utf-8' }
    );
    expect(output).toContain('Initializing locale: es (Español)');
    expect(output).toContain('Added "es" = "Español" to locale_names');
  });

  it('handles unknown locales', () => {
    // Requires --name
    try {
      execSync('node experiences/aricanga/utils/translation/cli.js init xx --dry-run', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      const err = error as { stderr: string };
      expect(err.stderr).toContain('Unknown locale');
      expect(err.stderr).toContain('--name');
    }

    // Accepts custom name
    const output = execSync(
      'node experiences/aricanga/utils/translation/cli.js init xx --name "Test Language" --dry-run',
      { encoding: 'utf-8' }
    );
    expect(output).toContain('Initializing locale: xx (Test Language)');
  });
});

// ============================================================================
// Status Command Tests
// ============================================================================
describe('Status Command', () => {
  it('shows locale information and completion status', () => {
    const output = execSync('node experiences/aricanga/utils/translation/cli.js status', {
      encoding: 'utf-8',
    });

    expect(output).toContain('Source locale: en');
    expect(output).toContain('Config strings:');
    expect(output).toContain('Ink strings:');
    expect(output).toContain('Locale');

    // --check mode - may exit non-zero if incomplete, so catch and check output
    let checkOutput: string;
    try {
      checkOutput = execSync('node experiences/aricanga/utils/translation/cli.js status --check', {
        encoding: 'utf-8',
      });
    } catch (e: any) {
      // Non-zero exit means incomplete translations - check stderr/stdout
      checkOutput = e.stdout || e.stderr || '';
    }
    expect(checkOutput).toMatch(/✓ All locales complete|✗ \w+:/);
  });
});

// ============================================================================
// Import Command Tests - consolidated error handling
// ============================================================================
describe('Import Command', () => {
  // Parameterized error cases
  const IMPORT_ERROR_CASES = [
    {
      name: 'file not found',
      setup: () => ({ path: 'nonexistent.json', locale: '-l fr' }),
      expectedError: 'Translation file not found',
    },
    {
      name: 'locale not specified',
      setup: () => {
        const tmpDir = getTmpDir();
        const jsonPath = join(tmpDir, 'test.json');
        writeFileSync(jsonPath, '{"strings":[]}');
        return { path: jsonPath, locale: '', cleanup: () => rmSync(tmpDir, { recursive: true, force: true }) };
      },
      expectedError: 'Target locale is required',
    },
    {
      name: 'invalid JSON',
      setup: () => {
        const tmpDir = getTmpDir();
        const jsonPath = join(tmpDir, 'invalid.json');
        writeFileSync(jsonPath, '{ invalid json }');
        return { path: jsonPath, locale: '-l fr', cleanup: () => rmSync(tmpDir, { recursive: true, force: true }) };
      },
      expectedError: 'Invalid JSON',
    },
  ] as const;

  for (const { name, setup, expectedError } of IMPORT_ERROR_CASES) {
    it(`fails gracefully: ${name}`, () => {
      const { path, locale, cleanup } = setup() as { path: string; locale: string; cleanup?: () => void };
      try {
        execSync(`node experiences/aricanga/utils/translation/cli.js import ${path} ${locale}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const err = error as { stderr: string };
        expect(err.stderr).toContain(expectedError);
      } finally {
        cleanup?.();
      }
    });
  }

  it('handles empty translation file', () => {
    const tmpDir = getTmpDir();
    const jsonPath = join(tmpDir, 'empty.json');
    writeFileSync(jsonPath, '{"strings":[]}');

    const output = execSync(
      `node experiences/aricanga/utils/translation/cli.js import ${jsonPath} -l fr`,
      { encoding: 'utf-8' }
    );
    expect(output).toContain('No translations to import');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('--dry-run shows diff without modifying files', () => {
    const tmpDir = getTmpDir();
    const data = JSON.parse(execSync(
      'node experiences/aricanga/utils/translation/cli.js extract -l fr -f json --scope config',
      { encoding: 'utf-8' }
    ));

    // Add mock translations
    for (const str of data.strings.slice(0, 2)) {
      str.translation = `[FR] ${str.source}`;
    }

    const jsonPath = join(tmpDir, 'with-translations.json');
    writeFileSync(jsonPath, JSON.stringify(data));

    const output = execSync(
      `node experiences/aricanga/utils/translation/cli.js import ${jsonPath} -l fr --dry-run`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('DRY RUN');
    expect(output).toContain('Config changes');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates TOML config strings', () => {
    const tmpDir = getTmpDir();
    const frTomlPath = getLocalePath('fr');
    const originalContent = existsSync(frTomlPath)
      ? readFileSync(frTomlPath, 'utf-8')
      : null;

    try {
      const jsonPath = join(tmpDir, 'config-import.json');
      writeFileSync(jsonPath, JSON.stringify({
        strings: [{
          id: 'config.ui.hub.title',
          source: 'Messages',
          translation: 'Messages TEST IMPORT',
          type: 'config',
        }],
      }));

      const output = execSync(
        `node experiences/aricanga/utils/translation/cli.js import ${jsonPath} -l fr`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Updated');
      expect(output).toContain('Config strings: 1 applied');

      const updatedContent = readFileSync(frTomlPath, 'utf-8');
      expect(updatedContent).toContain('Messages TEST IMPORT');
    } finally {
      if (originalContent) {
        writeFileSync(frTomlPath, originalContent);
      }
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects format from extension and parses prompt format', () => {
    const tmpDir = getTmpDir();

    // JSON auto-detect
    const jsonPath = join(tmpDir, 'auto.json');
    writeFileSync(jsonPath, '{"strings":[]}');
    expect(execSync(`node experiences/aricanga/utils/translation/cli.js import ${jsonPath} -l fr`, { encoding: 'utf-8' }))
      .toContain('format: json');

    // Prompt format
    const promptPath = join(tmpDir, 'prompt.txt');
    writeFileSync(promptPath, '```json\n{"items":[{"id":"x","source":"A","translation":"B"}]}\n```');
    const promptOutput = execSync(
      `node experiences/aricanga/utils/translation/cli.js import ${promptPath} -l fr -f prompt`,
      { encoding: 'utf-8' }
    );
    expect(promptOutput).toContain('format: prompt');
    expect(promptOutput).toContain('Found 1 translation items');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('shows summary of applied changes', () => {
    const tmpDir = getTmpDir();
    const data = JSON.parse(execSync(
      'node experiences/aricanga/utils/translation/cli.js extract -l fr -f json --scope config',
      { encoding: 'utf-8' }
    ));
    if (data.strings.length > 0) {
      data.strings[0].translation = `[FR] ${data.strings[0].source}`;
    }

    const jsonPath = join(tmpDir, 'summary.json');
    writeFileSync(jsonPath, JSON.stringify(data));

    const frTomlPath = getLocalePath('fr');
    const originalContent = existsSync(frTomlPath) ? readFileSync(frTomlPath, 'utf-8') : null;

    try {
      const output = execSync(
        `node experiences/aricanga/utils/translation/cli.js import ${jsonPath} -l fr`,
        { encoding: 'utf-8' }
      );
      expect(output).toContain('Summary:');
      expect(output).toContain('Config strings:');
      expect(output).toContain('Ink strings:');
    } finally {
      if (originalContent) writeFileSync(frTomlPath, originalContent);
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ============================================================================
// Check Command Tests
// ============================================================================
describe('Check Command', () => {
  it('requires locale and rejects source locale', () => {
    // No locale
    try {
      execSync('node experiences/aricanga/utils/translation/cli.js check', { encoding: 'utf-8', stdio: 'pipe' });
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect((error as { stderr: string }).stderr).toContain('Locale is required');
    }

    // Source locale
    try {
      execSync('node experiences/aricanga/utils/translation/cli.js check en', { encoding: 'utf-8', stdio: 'pipe' });
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect((error as { stderr: string }).stderr).toContain('Cannot check source locale');
    }
  });

  it('check fr shows summary', () => {
    // check command may exit non-zero if issues found, so handle both cases
    let output: string;
    try {
      output = execSync('node experiences/aricanga/utils/translation/cli.js check fr', { encoding: 'utf-8' });
    } catch (e: any) {
      // Non-zero exit means issues found - check stdout for expected output
      output = e.stdout || '';
    }
    expect(output).toContain('Checking locale: fr');
    expect(output).toContain('Summary');
  });
});

// ============================================================================
// Translate Command Tests
// ============================================================================
describe('Translate Command', () => {
  it('requires locale and rejects unknown providers', () => {
    // No locale
    try {
      execSync('node experiences/aricanga/utils/translation/cli.js translate --dry-run', { encoding: 'utf-8', stdio: 'pipe' });
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect((error as { stderr: string }).stderr).toContain('Target locale is required');
    }

    // Unknown provider
    try {
      execSync('node experiences/aricanga/utils/translation/cli.js translate -l fr -p unknown --dry-run', { encoding: 'utf-8', stdio: 'pipe' });
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect((error as { stderr: string }).stderr).toContain('Unknown provider');
    }
  });

  it('--dry-run shows batch preview without API call', () => {
    const output = execSync('node experiences/aricanga/utils/translation/cli.js translate -l fr --dry-run', { encoding: 'utf-8' });
    expect(output).toContain('provider');
    expect(output).toContain('targetLocale');
    expect(output).toContain('batchCount');
  });

  it('--provider fake runs full pipeline deterministically', () => {
    const run1 = JSON.parse(execSync('node experiences/aricanga/utils/translation/cli.js translate -l es -p fake --scope config', { encoding: 'utf-8' }));
    const run2 = JSON.parse(execSync('node experiences/aricanga/utils/translation/cli.js translate -l es -p fake --scope config', { encoding: 'utf-8' }));

    expect(run1.metadata).toMatchObject({ provider: 'fake', target: 'es' });
    expect(run1.strings[0].translation).toContain('[es]');
    expect(run1.strings[0].translation).toBe(run2.strings[0].translation); // Deterministic
  });
});

// ============================================================================
// Names Command Tests
// ============================================================================
describe('Names Command', () => {
  it('requires --context', () => {
    try {
      execSync('node experiences/aricanga/utils/translation/cli.js names', { encoding: 'utf-8', stdio: 'pipe' });
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect((error as { stderr: string }).stderr).toContain('--context');
    }
  });

  it('--provider fake works and --type filters output', () => {
    const allData = JSON.parse(execSync(
      'node experiences/aricanga/utils/translation/cli.js names --context "French" --provider fake',
      { encoding: 'utf-8' }
    ));
    expect(allData.metadata.provider).toBe('fake');
    expect(allData.suggestions.characters).toBeInstanceOf(Array);
    expect(allData.suggestions.entities).toBeInstanceOf(Array);

    // --type characters
    const charData = JSON.parse(execSync(
      'node experiences/aricanga/utils/translation/cli.js names --context "French" --provider fake --type characters',
      { encoding: 'utf-8' }
    ));
    expect(charData.suggestions.characters.length).toBeGreaterThan(0);
    expect(charData.suggestions.entities.length).toBe(0);

    // --type entities
    const entityData = JSON.parse(execSync(
      'node experiences/aricanga/utils/translation/cli.js names --context "French" --provider fake --type entities',
      { encoding: 'utf-8' }
    ));
    expect(entityData.suggestions.entities.length).toBeGreaterThan(0);
    expect(entityData.suggestions.characters.length).toBe(0);
  });
});

// ============================================================================
// Validate Command Tests
// ============================================================================
describe('Validate Command', () => {
  it('validates maxLength constraints', () => {
    const tmpDir = getTmpDir();

    // Over limit - should fail
    const overPath = join(tmpDir, 'over.json');
    writeFileSync(overPath, JSON.stringify({
      strings: [{
        id: 'test',
        source: 'News',
        translation: 'This translation is way too long for the constraint',
        constraints: { maxLength: 20, uiElement: 'hub.name' },
      }],
    }));

    try {
      execSync(`node experiences/aricanga/utils/translation/cli.js validate ${overPath}`, { encoding: 'utf-8', stdio: 'pipe' });
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect((error as { stdout: string }).stdout).toContain('exceeds maxLength');
      expect((error as { stdout: string }).stdout).toContain('Validation FAILED');
    }

    // Within limit - should pass
    const withinPath = join(tmpDir, 'within.json');
    writeFileSync(withinPath, JSON.stringify({
      strings: [{
        id: 'test',
        source: 'News',
        translation: 'Actualités',
        constraints: { maxLength: 20, uiElement: 'hub.name' },
      }],
    }));

    const output = execSync(`node experiences/aricanga/utils/translation/cli.js validate ${withinPath}`, { encoding: 'utf-8' });
    expect(output).toContain('Validation PASSED');

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ============================================================================
// Translation Edge Cases - parameterized fakeTranslate and validateTranslation
// ============================================================================
describe('Translation Edge Cases', () => {
  const FAKE_TRANSLATE_CASES = [
    { name: 'preserves {placeholders}', source: 'Hello {name}, welcome to {place}!', check: (t: string) => t.includes('{name}') && t.includes('{place}') },
    { name: 'preserves ((learning::markers))', source: 'The ((Capitol::building)) is important.', check: (t: string) => t.includes('((Capitol::building))') },
    { name: 'handles empty strings', source: '', check: (t: string) => t === '' },
    { name: 'ignores ink flow keywords', source: '{not seen}Welcome {name}!', check: (t: string) => t.includes('{name}') && !t.includes('{not seen}') },
  ] as const;

  for (const { name, source, check } of FAKE_TRANSLATE_CASES) {
    it(`fakeTranslate ${name}`, async () => {
      const { fakeTranslate } = await import('../../utils/translation/llm.js');
      const result = fakeTranslate([{ id: 'test', source }], 'French');
      expect(check(result[0].translation)).toBe(true);
    });
  }

  const VALIDATE_CASES = [
    { name: 'detects missing placeholder', source: 'Hello {name}!', translation: 'Bonjour!', expectError: 'missing_placeholder' },
    { name: 'detects extra placeholder', source: 'Hello!', translation: 'Bonjour {nom}!', expectError: 'extra_placeholder' },
    { name: 'detects missing learning marker', source: 'The ((Capitol::building)) is here.', translation: 'Le bâtiment est ici.', expectError: 'missing_marker' },
    { name: 'detects empty translation', source: 'Hello!', translation: '', expectError: 'empty_translation' },
    { name: 'passes when preserved', source: 'Hello {name}, ((Capitol::building))!', translation: 'Bonjour {name}, ((Capitol::building))!', expectError: null },
    { name: 'ignores ink flow keywords', source: '{not seen_intro}Hello {name}!', translation: 'Bonjour {name}!', expectError: null },
  ] as const;

  for (const { name, source, translation, expectError } of VALIDATE_CASES) {
    it(`validateTranslation ${name}`, async () => {
      const { validateTranslation } = await import('../../utils/translation/llm.js');
      const errors = validateTranslation(source, translation);
      if (expectError) {
        expect(errors.some(e => e.type === expectError)).toBe(true);
      } else {
        expect(errors).toEqual([]);
      }
    });
  }
});

// ============================================================================
// Unit Tests - consolidated parsing and filtering functions
// ============================================================================
describe('Unit: filterIncremental', () => {
  it('filters based on hash and status', async () => {
    const { filterIncremental } = await import('../../utils/translation/commands/extract.js');
    const { hashString } = await import('../../../../utils/lib/ink-parser.js');

    // Excludes translated with matching hash
    expect(filterIncremental(
      [{ id: 'a', source: 'Hello' }],
      { strings: { a: { sourceHash: hashString('Hello'), status: 'translated' } } }
    )).toHaveLength(0);

    // Includes new strings
    expect(filterIncremental([{ id: 'new', source: 'New' }], { strings: {} })).toHaveLength(1);

    // Includes when hash changed
    expect(filterIncremental(
      [{ id: 'a', source: 'Updated' }],
      { strings: { a: { sourceHash: 'old-hash', status: 'translated' } } }
    )).toHaveLength(1);

    // Includes strings with status new
    expect(filterIncremental(
      [{ id: 'a', source: 'Hello' }],
      { strings: { a: { sourceHash: hashString('Hello'), status: 'new' } } }
    )).toHaveLength(1);
  });
});

describe('Unit: parsePrompt', () => {
  it('extracts JSON from markdown code blocks', async () => {
    const { parsePrompt } = await import('../../utils/translation/commands/import.js');

    expect(parsePrompt('Text\n```json\n{"items":[{"id":"a"}]}\n```\nMore')).toEqual([{ id: 'a' }]);
    expect(parsePrompt('```json\n{"strings":[{"id":"b"}]}\n```')).toEqual([{ id: 'b' }]);
    expect(parsePrompt('```json\n  {"items":[{"id":"x"}]}  \n```')).toEqual([{ id: 'x' }]);
    expect(() => parsePrompt('no code block')).toThrow('No JSON code block');
  });
});

describe('Unit: parseJson', () => {
  it('handles various JSON structures', async () => {
    const { parseJson } = await import('../../utils/translation/commands/import.js');

    expect(parseJson('{"items":[{"id":"x"}]}')).toEqual([{ id: 'x' }]);
    expect(parseJson('{"strings":[{"id":"y"}]}')).toEqual([{ id: 'y' }]);
    expect(parseJson('{}')).toEqual([]);
    expect(parseJson('{"items":[{"id":"a"}],"strings":[{"id":"b"}]}')).toEqual([{ id: 'a' }]); // items precedence
  });
});

describe('Unit: parseXliff', () => {
  it('extracts and unescapes translation units', async () => {
    const { parseXliff } = await import('../../utils/translation/commands/import.js');

    expect(parseXliff('<unit id="t"><source>Hello</source><target>Bonjour</target></unit>'))
      .toEqual([{ id: 't', source: 'Hello', translation: 'Bonjour' }]);

    // Unescapes entities
    const result = parseXliff('<unit id="t"><source>&lt;tag&gt;</source><target>&amp;text</target></unit>');
    expect(result[0].source).toBe('<tag>');
    expect(result[0].translation).toBe('&text');

    // Multiple units and empty
    expect(parseXliff('<unit id="a"><source>One</source><target>Un</target></unit><unit id="b"><source>Two</source><target>Deux</target></unit>')).toHaveLength(2);
    expect(parseXliff('<xliff></xliff>')).toEqual([]);
  });
});

describe('Unit: extractPlaceholders and extractHighlights', () => {
  it('extracts patterns correctly', async () => {
    const { extractPlaceholders, extractHighlights } = await import('../../utils/translation/commands/validate.js');

    // Placeholders
    expect(extractPlaceholders('Hello {name}, {count} messages')).toEqual(new Set(['{name}', '{count}']));
    expect(extractPlaceholders('No placeholders').size).toBe(0);
    expect(extractPlaceholders('').size).toBe(0);
    expect(extractPlaceholders('{name} and {name}').size).toBe(1); // deduped

    // Highlights
    expect(extractHighlights('The ((Capitol::building)) is important')).toEqual(new Set(['((Capitol::building))']));
    expect(extractHighlights('((A::B)) and ((C::D))').size).toBe(2);
    expect(extractHighlights('No highlights').size).toBe(0);
    expect(extractHighlights('').size).toBe(0);
  });
});
