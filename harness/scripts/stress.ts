/**
 * `pnpm run test:stress [-- --seed N --copies N --repeats N <filters>]`: hunt for flaky tests. Prints
 * the base seed first, then each copy's result, and the command that replays a failing hunt.
 */

import { hunt, huntOf } from '../lib/stress.ts';

const options = huntOf(process.argv.slice(2));
process.stdout.write(`test:stress: base seed ${options.seed}, ${options.copies} copies, ${options.repeats} repeats\n`);
const results = await hunt(options);
const failed = results.filter((result) => result.status !== 0);
for (const result of failed) {
  process.stdout.write(`seed ${result.seed} failed:\n${result.output}\n`);
}
process.stdout.write(`test:stress: ${results.length - failed.length} of ${results.length} copies passed\n`);
if (failed.length > 0) {
  process.stdout.write(`replay: pnpm run test:stress -- --seed ${options.seed} --copies ${options.copies} --repeats ${options.repeats}\n`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
