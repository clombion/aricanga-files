/** The scan's readers: a path it does not cover is refused, and a missing symbol has no name. */

import { describe, expect, test } from 'vitest';
import { qualifiedName, sourceOf } from '#lib/checker.ts';
import { present } from '#lib/present.ts';
import { usePlanted } from '#lib/scan-hooks.ts';

const scan = usePlanted(new Map([['planted/one.ts', 'export const one = 1;\n']]));

describe('a scan', () => {
  test('refuses a path it does not cover, naming it', () => {
    expect.hasAssertions();
    expect(() => sourceOf(scan(), 'planted/two.ts')).toThrow('the scan does not cover planted/two.ts');
  });

  test('gives a missing symbol no qualified name', () => {
    expect.hasAssertions();
    const [statement] = sourceOf(scan(), 'planted/one.ts').statements;
    const { checker } = scan();
    const symbol = checker.getSymbolAtLocation(present(statement, 'the planted statement'));
    expect(qualifiedName(checker, symbol)).toBeUndefined();
  });
});
