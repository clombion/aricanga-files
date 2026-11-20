/** Find copied code in the held TypeScript with jscpd; exit 1 on any problem (`harness/lib/dupes.ts`). */

import { ALLOWED, scan } from '../lib/dupes.ts';
import { REPO_ROOT } from '../lib/paths.ts';
import { ROOTS, typescriptFiles } from '../lib/scope.ts';

const listed = typescriptFiles();
const rootFiles = listed.filter((path) => !ROOTS.some((root) => path.startsWith(root)));
const problems = scan(REPO_ROOT, [...ROOTS.map((root) => root.replace(/\/$/, '')), ...rootFiles], listed, ALLOWED);
process.stderr.write(problems.map((problem) => `${problem}\n`).join(''));
if (problems.length === 0) {
  process.stdout.write(`no copied code in the ${listed.length} held TypeScript files\n`);
}
process.exitCode = problems.length === 0 ? 0 : 1;
