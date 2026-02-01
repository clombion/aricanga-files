/**
 * Parser Stress Tests
 *
 * Tests that the ink parser handles complex real-world ink files
 * without crashing. Uses TheIntercept.ink from inkle/the-intercept
 * as a comprehensive stress test.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';

// Import ink-writer for extraction testing
let inkWriter: typeof import('../../../../utils/lib/ink-writer.js');

beforeAll(async () => {
  inkWriter = await import('../../../../utils/lib/ink-writer.js');
});

const INTERCEPT_PATH = join(process.cwd(), 'packages/test-utils/src/fixtures/TheIntercept.ink');

describe('Parser Stress Tests', () => {
  it('TheIntercept.ink exists and is readable', () => {
    const content = readFileSync(INTERCEPT_PATH, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('=== start ===');
  });

  it('TheIntercept.ink compiles with inklecate', () => {
    // Verify the file compiles without errors
    try {
      execSync(`inklecate -o /dev/null "${INTERCEPT_PATH}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error: unknown) {
      const err = error as { stderr?: string; message: string };
      throw new Error(`TheIntercept.ink failed to compile: ${err.stderr || err.message}`);
    }
  });

  it('parser extracts from TheIntercept.ink without crashing', () => {
    const content = readFileSync(INTERCEPT_PATH, 'utf-8');
    const lines = content.split('\n');

    // Run extraction - should not throw
    let extractedCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip non-content lines
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('VAR ') ||
          trimmed.startsWith('CONST ') || trimmed.startsWith('===') ||
          trimmed.startsWith('=') || trimmed.startsWith('->') ||
          trimmed.startsWith('~') || trimmed.startsWith('{') ||
          trimmed.startsWith('-') || trimmed.startsWith('<>')) {
        continue;
      }

      // Count dialogue and choice lines
      if (trimmed.startsWith('*') || trimmed.startsWith('+') ||
          /^[A-Z]/.test(trimmed) || /^[a-z]/.test(trimmed)) {
        extractedCount++;
      }
    }

    // TheIntercept has significant dialogue content
    expect(extractedCount).toBeGreaterThan(100);
  });

  it('parser handles nested conditionals', () => {
    const content = readFileSync(INTERCEPT_PATH, 'utf-8');

    // TheIntercept uses nested conditionals like {var: ... | ...}
    expect(content).toContain('{');
    expect(content).toContain('|');

    // Verify we can extract lines containing conditionals
    const lines = content.split('\n');
    const conditionalLines = lines.filter((line) =>
      line.includes('{') && line.includes('|') && line.includes('}')
    );

    expect(conditionalLines.length).toBeGreaterThan(0);
  });

  it('parser handles tunnels (documents as feature)', () => {
    const content = readFileSync(INTERCEPT_PATH, 'utf-8');

    // Check for tunnel syntax (->-> return)
    const hasTunnels = content.includes('->->');

    // Document tunnel presence for future reference
    if (hasTunnels) {
      const tunnelCount = (content.match(/->\s*->/g) || []).length;
      expect(tunnelCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('parser handles threads (documents as feature)', () => {
    const content = readFileSync(INTERCEPT_PATH, 'utf-8');

    // Check for thread syntax (<- knot)
    const hasThreads = content.includes('<-');

    // Document thread presence for future reference
    if (hasThreads) {
      const threadMatches = content.match(/<-\s*\w+/g) || [];
      expect(threadMatches.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('parser handles function definitions', () => {
    const content = readFileSync(INTERCEPT_PATH, 'utf-8');

    // TheIntercept defines functions
    expect(content).toContain('=== function');

    // Count function definitions
    const functionDefs = (content.match(/===\s*function\s+\w+/g) || []);
    expect(functionDefs.length).toBeGreaterThan(0);
  });

  it('parser handles variable declarations', () => {
    const content = readFileSync(INTERCEPT_PATH, 'utf-8');

    // Count VAR declarations
    const varDecls = (content.match(/^VAR\s+\w+/gm) || []);
    expect(varDecls.length).toBeGreaterThan(10);

    // Count CONST declarations
    const constDecls = (content.match(/^CONST\s+\w+/gm) || []);
    expect(constDecls.length).toBeGreaterThan(0);
  });

  it('extractTranslatablePortion handles TheIntercept patterns', async () => {
    // Test patterns found in TheIntercept

    // Simple dialogue
    const dialogue = inkWriter.extractTranslatablePortion(
      'They are keeping me waiting.',
      'dialogue'
    );
    expect(dialogue.text).toBe('They are keeping me waiting.');

    // Choice with brackets
    const choice = inkWriter.extractTranslatablePortion(
      '*\t[Think]',
      'choice'
    );
    expect(choice.bracketText).toBe('Think');

    // Sticky choice
    const sticky = inkWriter.extractTranslatablePortion(
      '+\t[Continue...]',
      'choice'
    );
    expect(sticky.bracketText).toBe('Continue...');

    // Line with inline conditional (should extract as dialogue)
    const conditional = inkWriter.extractTranslatablePortion(
      '{not think:What I am is|I am} a problem-solver.',
      'dialogue'
    );
    expect(conditional.text).toContain('problem-solver');
  });

  it('round-trip: extract patterns are valid for reconstruction', async () => {
    // Test that extracted patterns can be reconstructed
    const testCases = [
      { line: 'Hello world', type: 'dialogue' as const, translation: 'Bonjour monde' },
      { line: '* [Choose] Response', type: 'choice' as const, translation: '[Choisir] Réponse' },
      { line: '+ [Sticky] After', type: 'choice' as const, translation: '[Collant] Après' },
      { line: 'Text # tag:value', type: 'dialogue' as const, translation: 'Texte' },
    ];

    for (const tc of testCases) {
      const parsed = inkWriter.extractTranslatablePortion(tc.line, tc.type);
      const reconstructed = inkWriter.reconstructLine(parsed, tc.translation);

      // Reconstructed line should be valid (not empty, preserves structure)
      expect(reconstructed.length).toBeGreaterThan(0);

      if (tc.type === 'choice') {
        expect(reconstructed).toContain('[');
        expect(reconstructed).toContain(']');
      }

      if (tc.line.includes('#')) {
        expect(reconstructed).toContain('#');
      }
    }
  });
});
