/** Type-check every held TypeScript project with `tsc --noEmit`; exit non-zero if any fails. */

import { bin, finished } from '#lib/tools.ts';
import { exitCode, say, succeeded } from '#lib/output.ts';
import type { Finished } from '#lib/process.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import { isEmpty } from '#lib/lists.ts';
import { projects } from '#lib/projects.ts';

/**
 * Type-check each project, saying each failure and a summary.
 *
 * @returns {Promise<number>} The script's exit code.
 */
async function main(): Promise<number> {
  const all = await projects();
  const outcomes = await Promise.all(
    all.map(async (project) => {
      const outcome = await finished([bin('tsc'), '--noEmit', '-p', project], { cwd: REPO_ROOT });
      return [project, outcome] as const;
    }),
  );
  const failed = outcomes.filter(([project, outcome]: readonly [string, Finished]) => {
    if (!succeeded(outcome)) {
      say(`${project}\n${outcome.stdout}${outcome.stderr}`);
    }
    return !succeeded(outcome);
  });
  say(`typecheck: ${all.length} projects, ${failed.length} failed`);
  return exitCode(isEmpty(failed));
}

process.exitCode = await main();
