/** The syntax readers: an empty JSX expression holds no comment, and only named imports of a name bind it. */

import { comments, importsFrom, parse } from '#lib/ts-source.ts';
import { describe, expect, test } from 'vitest';

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
