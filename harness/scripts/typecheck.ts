/** Type-check every held TypeScript project with `tsc --noEmit`; exit non-zero if any fails. */

import { bin, finished } from '#lib/tools.ts';
import { exitCode, say, succeeded } from '#lib/output.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import { isEmpty } from '#lib/lists.ts';
import { projects } from '#lib/projects.ts';

/**
 * Type-check each project, saying each failure and a summary.
 *
 * @returns {number} The script's exit code.
 */
function main(): number {
  const all = projects();
  const failed = all.filter((project) => {
    const outcome = finished([bin('tsc'), '--noEmit', '-p', project], { cwd: REPO_ROOT });
    if (!succeeded(outcome)) {
      say(`${project}\n${outcome.stdout}${outcome.stderr}`);
    }
    return !succeeded(outcome);
  });
  say(`typecheck: ${all.length} projects, ${failed.length} failed`);
  return exitCode(isEmpty(failed));
}

process.exitCode = main();
