/**
 * `importedModules` names the files that answer a module's specifiers: a source file, an ambient
 * `declare module` of a script file; never the platform's declarations, nor an augmentation (a
 * `declare module` of a module file), which adds to a module another declaration answers (the user's
 * decision D8).
 */

import { describe, expect, test } from 'vitest';
import { importedModules } from '#lib/imports-of.ts';
import { sourceOf } from '#lib/checker.ts';
import { usePlanted } from '#lib/scan-hooks.ts';

const USER = 'harness/lib/__imports_user.ts';

const scan = usePlanted(
  [
    [
      USER,
      "import { v } from './__imports_source.ts';\nimport { w } from 'imports-ambient';\nimport { describe } from 'vitest';\n\nexport const read = [v, w, describe];\n",
    ],
    ['harness/lib/__imports_source.ts', 'export const v = 1;\n'],
    ['harness/lib/__imports_ambient.d.ts', "declare module 'imports-ambient' {\n  export const w: number;\n}\n"],
    ['harness/lib/__imports_augment.ts', "declare module 'vitest' {\n  export const augmented: number;\n}\n\nexport {};\n"],
  ],
  [],
);

describe('the modules a module imports', () => {
  test("names a source file and a script file's ambient module, and neither the platform's declarations nor an augmentation", () => {
    expect.hasAssertions();
    const user = sourceOf(scan(), USER);
    expect(importedModules(scan(), user)).toStrictEqual(['harness/lib/__imports_source.ts', 'harness/lib/__imports_ambient.d.ts']);
  });
});
