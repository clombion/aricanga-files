/** The syntax readers: an empty JSX expression holds no comment, and only named imports of a name bind it. */

import { comments, holdsNoRuntimeValue, importsFrom, nodes, parse } from '#lib/ts-source.ts';
import { describe, expect, test } from 'vitest';
import { isStringLiteral } from 'typescript/unstable/ast';

describe('the comment reader', () => {
  test('finds no comment inside an empty JSX expression, and one written there', () => {
    expect.hasAssertions();
    const empty = parse('planted/empty.tsx', 'export const view = <p>{}</p>;\n');
    const written = parse('planted/written.tsx', 'export const view = <p>{/* planted */}</p>;\n');
    expect(comments(empty)).toStrictEqual([]);
    expect(comments(written).map((comment) => comment.text)).toStrictEqual(['/* planted */']);
  });
});

describe('the import reader', () => {
  test('binds named imports by identifier, and nothing for a default import or a string name', () => {
    expect.hasAssertions();
    const file = parse(
      'planted/imports.ts',
      "import planted from 'planted';\nimport { 'string name' as quoted, one, two as second } from 'planted';\nexport { planted, quoted, one, second };\n",
    );
    expect([...importsFrom(file, 'planted')]).toStrictEqual([
      ['one', 'one'],
      ['second', 'two'],
    ]);
  });
});

/**
 * Each string literal of a module with whether it holds no runtime value.
 *
 * @param {string} text - The module's text.
 * @returns {Readonly<Record<string, boolean>>} Each literal's text with the reader's answer.
 */
function runtimeAnswers(text: string): Readonly<Record<string, boolean>> {
  return Object.fromEntries(
    nodes(parse('probe/x.ts', text)).flatMap((node) =>
      isStringLiteral(node) && !node.text.startsWith('.') ? [[node.text, holdsNoRuntimeValue(node)] as const] : [],
    ),
  );
}

describe('the runtime-value reader', () => {
  test('reads a type, an interface, an alias and an import as holding no runtime value, and a value or a class member as holding one', () => {
    expect.hasAssertions();
    const text = [
      "import type { T } from './t';",
      'declare function base(word: string): new () => object;',
      "export class A extends base('extended') implements I { kept = 'member'; }",
      "export interface I { 'keyed': number }",
      "export type Alias = 'aliased';",
      "export const plain = 'plain';",
      'export type U = T;',
      '',
    ].join('\n');
    expect(runtimeAnswers(text)).toStrictEqual({ aliased: true, extended: true, keyed: true, member: false, plain: false });
  });
});
