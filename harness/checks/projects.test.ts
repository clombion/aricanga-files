/** One project is type-checked by the locked `tsc` from the root it is given, emitting nothing. */

import { EXIT_CLEAN, EXIT_FINDINGS } from '#lib/exit-status.ts';
import { describe, expect, test } from 'vitest';
import type { Finished } from '#lib/process.ts';
import { Project } from '#lib/tools.ts';
import { typecheckProject } from '#lib/projects.ts';

/** A planted project's config: strict, over one file. */
const CONFIG = '{ "compilerOptions": { "strict": true, "noEmit": true, "types": [] }, "files": ["a.ts"] }\n';

/**
 * Type-check a planted project holding one file.
 *
 * @param {string} source - The file's text.
 * @returns {Promise<Finished>} The finished `tsc` run.
 */
async function checked(source: string): Promise<Finished> {
  const project = await Project.create({ linkModules: false });
  try {
    await project.writeAll([
      ['tsconfig.json', CONFIG],
      ['a.ts', source],
    ]);
    const done = await typecheckProject('tsconfig.json', project.root);
    return done;
  } finally {
    await project.remove();
  }
}

describe('a type-checked project', () => {
  test('passes when its code is well typed', async () => {
    expect.hasAssertions();
    const done = await checked('export const count: number = 1;\n');
    expect([done.status, done.stdout]).toStrictEqual([EXIT_CLEAN, '']);
  });

  test('fails with the diagnostic when it is not', async () => {
    expect.hasAssertions();
    const done = await checked('export const count: number = "one";\n');
    expect([done.status, done.stdout.includes('TS2322')]).toStrictEqual([EXIT_FINDINGS, true]);
  });
});
