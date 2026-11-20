/** The gate's product build: every held Vite app builds in check mode and writes nothing into the checkout. */

import { apps, checkBuild } from '../lib/build.ts';
import { out } from '../lib/output.ts';

const results = apps().map((app) => checkBuild(app));
const failed = results.filter((result) => result.status !== 0);
const written = results.flatMap((result) => result.written);
for (const result of failed) {
  out(`${result.app} failed to build:\n${result.output}\n`);
}
for (const path of written) {
  out(`a build wrote into the checkout: ${path}\n`);
}
out(
  `build:check: ${results.length} apps, ${failed.length} failed, ${written.length} writes\n`,
);
process.exitCode = failed.length === 0 && written.length === 0 ? 0 : 1;
