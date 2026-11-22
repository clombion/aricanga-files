/**
 * Each entry script wires the real tools into its library function and ends with the exit code that
 * function returns. The scripts run in this process with their library functions stood in for, so
 * no build, hunt or type check starts.
 */

import { STDIN, STOOD_IN, exitOf, lastArgument, stoodIn } from './scripts.run.ts';
import { apps, checkBuild } from '#lib/build.ts';
import { buildCheck, checkPushed, genDocs, stressHunt, typecheckAll } from '#lib/script-entries.ts';
import { complain, out, say } from '#lib/output.ts';
import { describe, expect, test, vi } from 'vitest';
import { hunt, huntOf } from '#lib/stress.ts';
import { projects, typecheckProject } from '#lib/projects.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import type { StressRun } from '#lib/script-entries.ts';
import { run } from '#lib/generated.ts';
import { subjectsOf } from '#lib/pushed.ts';

/** The arguments before a script's own: the Node binary and the script's path. */
const OWN_ARGUMENTS = 2;

vi.mock(import('#lib/script-entries.ts'), () => ({
  buildCheck: vi.fn<() => Promise<number>>(stoodIn),
  checkPushed: vi.fn<() => Promise<number>>(stoodIn),
  genDocs: vi.fn<() => Promise<number>>(stoodIn),
  stressHunt: vi.fn<(stress: StressRun) => Promise<number>>(stoodIn),
  typecheckAll: vi.fn<() => Promise<number>>(stoodIn),
}));

vi.mock(import('#lib/output.ts'), async (original) => {
  const output = await original();
  const { stoodInput } = await import('./scripts.run.ts');
  return { ...output, standardInput: vi.fn<typeof output.standardInput>(stoodInput) };
});

describe('the entry scripts', () => {
  test('build-check builds the held apps with the real builder', async () => {
    expect.hasAssertions();
    await expect(exitOf('build-check.ts')).resolves.toBe(STOOD_IN);
    expect(buildCheck).toHaveBeenCalledWith({ apps: await apps(), check: checkBuild, out });
  });

  test('check-pushed reads its standard input and the repository it runs in', async () => {
    expect.hasAssertions();
    await expect(exitOf('check-pushed.ts')).resolves.toBe(STOOD_IN);
    expect(checkPushed).toHaveBeenCalledWith({ complain, cwd: process.cwd(), stdin: STDIN, subjects: subjectsOf });
  });

  test('gen-docs writes unless asked to check', async () => {
    expect.hasAssertions();
    await expect(exitOf('gen-docs.ts')).resolves.toBe(STOOD_IN);
    expect(genDocs).toHaveBeenCalledWith({ check: process.argv.includes('--check'), complain, run });
  });

  test('stress hunts with the options its own arguments give', async () => {
    expect.hasAssertions();
    await expect(exitOf('stress.ts')).resolves.toBe(STOOD_IN);
    const stress = lastArgument(vi.mocked(stressHunt).mock.calls);
    const expected = huntOf(process.argv.slice(OWN_ARGUMENTS)).filters;
    expect([stress.hunt, stress.out, stress.options.filters]).toStrictEqual([hunt, out, expected]);
  });

  test('typecheck checks every held project from the repository root', async () => {
    expect.hasAssertions();
    await expect(exitOf('typecheck.ts')).resolves.toBe(STOOD_IN);
    expect(typecheckAll).toHaveBeenCalledWith({ check: typecheckProject, projects: await projects(), root: REPO_ROOT, say });
  });
});
