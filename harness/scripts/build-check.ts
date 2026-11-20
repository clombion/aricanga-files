/** The gate's product build: every held Vite app builds in check mode and writes nothing into the checkout. */

import { apps, checkBuild } from '#lib/build.ts';
import { exitCode, out, succeeded } from '#lib/output.ts';
import { isEmpty } from '#lib/lists.ts';

/**
 * Build every app, reporting each failure and each write into the checkout.
 *
 * @returns {number} The script's exit code.
 */
function main(): number {
  const results = apps().map((app) => checkBuild(app));
  const failed = results.filter((result) => !succeeded(result));
  const written = results.flatMap((result) => result.written);
  for (const result of failed) {
    out(`${result.app} failed to build:\n${result.output}\n`);
  }
  for (const path of written) {
    out(`a build wrote into the checkout: ${path}\n`);
  }
  out(`build:check: ${results.length} apps, ${failed.length} failed, ${written.length} writes\n`);
  return exitCode(isEmpty(failed) && isEmpty(written));
}

process.exitCode = main();
