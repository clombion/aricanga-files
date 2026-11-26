/**
 * The fixers' writer writes a repository file as given, read back as written; and the held kinds are
 * stated once, in `TYPESCRIPT`: no other held module of the harness writes a held kind as a literal
 * of its own (a suffix, a glob's extension, a pattern's alternative). A test's expected values and
 * planted paths are its oracle, written out by design, so test modules and their plants are not read.
 */

import { TYPESCRIPT, textOf, textsOf, typescriptGlob, writeText } from '#lib/source-files.ts';
import { describe, expect, test } from 'vitest';
import {
  isNoSubstitutionTemplateLiteral,
  isRegularExpressionLiteral,
  isStringLiteral,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateTail,
} from 'typescript/unstable/ast';
import { mkdir, rm } from 'node:fs/promises';
import { nodes, parse } from '#lib/ts-source.ts';
import { fromRoot } from '#lib/paths.ts';
import { typescriptFiles } from '#lib/scope.ts';

/** The one statement of the held kinds. */
const OWNER = 'harness/lib/source-files.ts';

/**
 * A literal's text that writes the held kinds: `.ts` alone (a suffix a selection keys on), a glob's
 * braced extension, a glob of every module of a kind (`*.ts`, not `*.spec.ts`, which a tool's own
 * config fixes), or a pattern's optional `x`. `.tsx` alone names a JSX module, which a rule of the
 * view's may key on.
 */
const KIND_WRITTEN = /^\.ts$|\{ts,tsx\}|(?:^|\/)\*\.tsx?$|tsx\?/u;

/** A test module or a test's plants: their expected values and planted paths are written out. */
const TEST_MODULE = /\.(?:test|plants)\.tsx?$/u;

/** The plants of the planted test: a suffix, a glob's extension, a pattern and a glob of every module of a kind. */
const PLANTED_KINDS =
  "export const a = ['.ts'];\nexport const b = 'src/**/*.{ts,tsx}';\nexport const c = /\\.tsx?$/u;\nexport const d = '**/*.tsx';\n";

/**
 * Whether the scan reads a held module: the harness's, its owner and its tests and plants apart.
 *
 * @param {string} path - The module's path.
 * @returns {boolean} Whether it is read.
 */
function isRead(path: string): boolean {
  return path.startsWith('harness/') && path !== OWNER && !TEST_MODULE.test(path);
}

/**
 * Each literal of a module that writes a held kind, as `path: text`.
 *
 * @param {string} path - The module's path.
 * @param {string} text - Its text.
 * @returns {readonly string[]} Each such literal.
 */
function kindsWritten(path: string, text: string): readonly string[] {
  return nodes(parse(path, text)).flatMap((node) => {
    const literal =
      isStringLiteral(node) ||
      isNoSubstitutionTemplateLiteral(node) ||
      isRegularExpressionLiteral(node) ||
      isTemplateHead(node) ||
      isTemplateMiddle(node) ||
      isTemplateTail(node);
    return literal && KIND_WRITTEN.test(node.text) ? [`${path}: ${node.text}`] : [];
  });
}

describe('the held kinds', () => {
  test('are written by no held harness module but their owner, tests and plants apart', async () => {
    expect.hasAssertions();
    const held = await typescriptFiles();
    const texts = await textsOf(held.filter((path) => isRead(path)));
    expect(texts.flatMap(([path, text]: readonly [string, string]) => kindsWritten(path, text))).toStrictEqual([]);
  });

  test('are seen written as a suffix, a glob and a pattern, and composed from the owner', () => {
    expect.hasAssertions();
    expect([kindsWritten('a.ts', PLANTED_KINDS), typescriptGlob('**/*'), [...TYPESCRIPT]]).toStrictEqual([
      ['a.ts: .ts', 'a.ts: src/**/*.{ts,tsx}', String.raw`a.ts: /\.tsx?$/u`, 'a.ts: **/*.tsx'],
      '**/*.{ts,tsx}',
      ['.ts', '.tsx'],
    ]);
  });
});

/** A folder git ignores, so writing under it changes nothing the gate reads. */
const FOLDER = 'node_modules/.harness-planted';

/** The planted file, under the ignored folder. */
const PLANTED = `${FOLDER}/written.txt`;

describe("the fixers' writer", () => {
  test('writes a file that reads back as written', async () => {
    expect.hasAssertions();
    await mkdir(fromRoot(FOLDER), { recursive: true });
    try {
      await writeText(PLANTED, 'planted\n');
      await expect(textOf(PLANTED)).resolves.toBe('planted\n');
    } finally {
      await rm(fromRoot(FOLDER), { force: true, recursive: true });
    }
  });
});
