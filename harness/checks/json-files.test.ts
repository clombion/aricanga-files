/**
 * Every held JSON file is strict JSON a reader cannot misread, and no manifest lists a dependency twice.
 *
 * Each held `.json` file is read from its tokens (`harness/lib/json-strict.ts`): no comment and no
 * trailing comma, tsconfig files included (tsc reads strict JSON as well); no key written twice at
 * any depth, which `JSON.parse` silently keeps the last of; no empty key, no key outside Unicode
 * normal form C, no lone surrogate; no number JavaScript cannot hold as written. Each held
 * `package.json` lists no package in two dependency groups that conflict, nor twice in a bundled
 * list.
 */

import { describe, expect, test } from 'vitest';
import { duplicateDependencies } from './json-files.manifests.ts';
import { heldFiles } from '#lib/scope.ts';
import { json } from '#lib/config.ts';
import { jsonProblems } from '#lib/json-strict.ts';
import { textOf } from '#lib/source-files.ts';

const HARNESS_ID = 'json-files';

/** Each planted text and the problems the reader must find in it, exactly. */
const PLANTS: readonly (readonly [string, readonly string[]])[] = [
  ['{"a": {"b": 1, "c": {"d": 1, "d": 2}}}', ['$.a.c.d: the key is written twice; JSON.parse keeps the last']],
  ['{"": 1}', ['$.: the key is empty']],
  [String.raw`{"cafe\u0301": 1}`, ['$.cafe\u0301: the key is not in Unicode normal form C']],
  [String.raw`{"a": "\ud83d"}`, ['$.a: the string holds a lone surrogate']],
  ['{"a": 2e308}', ['$.a: the number 2e308 is outside the range JavaScript holds']],
  ['{"a": 1e-400}', ['$.a: the number 1e-400 rounds to zero']],
  ['{"a": 9007199254740993}', ['$.a: the integer 9007199254740993 is outside the safe integer range']],
  ['{"a": 1,}', ['$: not strict JSON: expected a key at offset 8']],
  ['{\n  // a comment\n  "a": 1\n}', ['$: not strict JSON: no JSON token at offset 4']],
  ['{"a": 1', ["$: not strict JSON: expected ',' or '}' at offset 6"]],
];

/** Texts every rule passes: equal keys in sibling objects, a safe integer, a whole surrogate pair, a normalised key. */
const NEAR_MISSES: readonly string[] = [
  '{"a": {"d": 1}, "b": {"d": 2}}',
  '{"a": 9007199254740991, "b": -0.5e-3, "c": 0}',
  String.raw`{"a": "\ud83d\ude00", "b": "\u00e9"}`,
  String.raw`{"caf\u00e9": [true, false, null, "x\n"]}`,
];

describe('the repository', () => {
  test('every held JSON file is strict JSON a reader cannot misread', async () => {
    expect.hasAssertions();
    const files = await heldFiles('.json', '.jsonc');
    const found = await Promise.all(
      files.map(async (path) => {
        const text = await textOf(path);
        return jsonProblems(text).map((problem) => `${path} ${problem.path}: ${problem.problem}`);
      }),
    );
    expect(found.flat()).toStrictEqual([]);
  });

  test('no held manifest lists a dependency twice', async () => {
    expect.hasAssertions();
    const manifests = await heldFiles('package.json');
    const found = await Promise.all(
      manifests.map(async (path) => {
        const text = await textOf(path);
        return duplicateDependencies(json(text)).map((problem) => `${path}: ${problem}`);
      }),
    );
    expect(found.flat()).toStrictEqual([]);
  });
});

describe('the reader, on planted texts', () => {
  test.each(PLANTS)('finds the problem in %j', (text, problems) => {
    expect.hasAssertions();
    expect(jsonProblems(text).map((found) => `${found.path}: ${found.problem}`)).toStrictEqual(problems);
  });

  test.each(NEAR_MISSES)('passes %j', (text) => {
    expect.hasAssertions();
    expect(jsonProblems(text)).toStrictEqual([]);
  });
});

describe('the manifest reading, on planted manifests', () => {
  test('finds a package in two conflicting groups, and one bundled twice', () => {
    expect.hasAssertions();
    const manifest = {
      bundleDependencies: ['beta', 'beta'],
      dependencies: { alpha: '1.0.0' },
      devDependencies: { alpha: '1.0.0' },
      optionalDependencies: { gamma: '1.0.0' },
      peerDependencies: { gamma: '1.0.0' },
    };
    expect(duplicateDependencies(manifest)).toStrictEqual([
      'alpha is in both dependencies and devDependencies',
      'gamma is in both optionalDependencies and peerDependencies',
      'beta is listed twice in bundleDependencies',
    ]);
  });

  test('lets a development dependency also be a peer or optional one', () => {
    expect.hasAssertions();
    expect(
      duplicateDependencies({
        devDependencies: { alpha: '1', beta: '1' },
        optionalDependencies: { beta: '1' },
        peerDependencies: { alpha: '1' },
      }),
    ).toStrictEqual([]);
  });
});

export { HARNESS_ID };
