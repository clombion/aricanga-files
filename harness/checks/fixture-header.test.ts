/** A fixture's header: the path it is planted at, and on a second line the compiler errors its source has on purpose. */

import { describe, expect, test } from 'vitest';
import { parseFixture } from '#lib/lint-fixtures.ts';

const FILE = 'harness/lint-rules/fixtures/labels/fire-htmlfor.fixture';

describe('the header of a fixture', () => {
  test('reads a `// tsc:` line as the codes it declares, and the source after it', () => {
    expect.hasAssertions();
    expect(parseFixture(FILE, '// path: a/b.tsx\n// tsc: TS2322 TS2307\nexport {};\n')).toStrictEqual({
      errors: ['TS2322', 'TS2307'],
      file: FILE,
      kind: 'fire',
      path: 'a/b.tsx',
      rule: 'labels',
      source: 'export {};\n',
    });
  });

  test('reads a `// tsc:` line only second, so one after the source starts is source', () => {
    expect.hasAssertions();
    const fixture = parseFixture(FILE, '// path: a/b.tsx\nexport {};\n// tsc: TS2322\n');
    expect([fixture.errors, fixture.source]).toStrictEqual([[], 'export {};\n// tsc: TS2322\n']);
  });
});
