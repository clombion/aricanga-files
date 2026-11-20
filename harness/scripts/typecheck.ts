/** Type-check every held TypeScript project with `tsc --noEmit`; exit non-zero if any fails. */

import { projects } from '../lib/projects.ts';
import { REPO_ROOT } from '../lib/paths.ts';
import { bin, finished } from '../lib/tools.ts';

let failed = 0;
for (const project of projects()) {
  const outcome = finished([bin('tsc'), '--noEmit', '-p', project], { cwd: REPO_ROOT });
  if (outcome.status !== 0) {
    failed += 1;
    process.stdout.write(`${project}\n${outcome.stdout}${outcome.stderr}\n`);
  }
}
process.stdout.write(`typecheck: ${projects().length} projects, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
