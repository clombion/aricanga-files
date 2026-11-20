/** Type-check every held TypeScript project with `tsc --noEmit`; exit non-zero if any fails. */

import { say } from '../lib/output.ts';
import { projects } from '../lib/projects.ts';
import { REPO_ROOT } from '../lib/paths.ts';
import { bin, finished } from '../lib/tools.ts';

let failed = 0;
for (const project of projects()) {
  const outcome = finished([bin('tsc'), '--noEmit', '-p', project], { cwd: REPO_ROOT });
  if (outcome.status !== 0) {
    failed += 1;
    say(`${project}\n${outcome.stdout}${outcome.stderr}`);
  }
}
say(`typecheck: ${projects().length} projects, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
