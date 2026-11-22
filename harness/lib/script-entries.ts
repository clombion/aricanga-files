/**
 * What the gate's entry scripts do, taking their inputs and where they report: each script under
 * `harness/scripts` wires the real tools in and sets its exit code from the result.
 */

import type { CopyResult, Hunt } from './stress.ts';
import { exitCode, succeeded } from './output.ts';
import { inSequence, isEmpty } from './lists.ts';
import { refused, revisions, updates } from './pushed.ts';
import type { BuildResult } from './build.ts';
import type { Finished } from './process.ts';
import type { Problem } from './generated.ts';

/** Where a script reports a line or a block of text. */
type Report = (text: string) => void;

/** A build check's inputs: the apps, how one is built, and where the result goes. */
interface BuildRun {
  readonly apps: readonly string[];
  readonly check: (app: string) => Promise<BuildResult>;
  readonly out: Report;
}

/** A docs run's inputs: whether it only compares, how the blocks are written, and where problems go. */
interface DocsRun {
  readonly check: boolean;
  readonly run: (check: boolean) => Promise<readonly Problem[]>;
  readonly complain: Report;
}

/** A flake hunt's inputs: its options, how it hunts, and where the result goes. */
interface StressRun {
  readonly options: Hunt;
  readonly hunt: (options: Hunt) => Promise<readonly CopyResult[]>;
  readonly out: Report;
}

/** A pre-push check's inputs: what git handed the hook, where it runs, how subjects are read, and where refusals go. */
interface PushRun {
  readonly stdin: string;
  readonly cwd: string;
  readonly subjects: (range: readonly string[], cwd: string) => Promise<readonly string[]>;
  readonly complain: Report;
}

/** A type check's inputs: the projects, how one is checked, and where the result goes. */
interface TypecheckRun {
  readonly projects: readonly string[];
  readonly root: string;
  readonly check: (project: string, root: string) => Promise<Finished>;
  readonly say: Report;
}

/**
 * Build every app, reporting each failure and each write into the checkout.
 *
 * @param {BuildRun} build - The apps, the builder and the report.
 * @returns {Promise<number>} The exit code: success when every app built and none wrote into the checkout.
 */
async function buildCheck(build: Readonly<BuildRun>): Promise<number> {
  const results = await inSequence(build.apps, async (app) => {
    const result = await build.check(app);
    return result;
  });
  const failed = results.filter((result) => !succeeded(result));
  const written = results.flatMap((result) => result.written);
  for (const result of failed) {
    build.out(`${result.app} failed to build:\n${result.output}\n`);
  }
  for (const path of written) {
    build.out(`a build wrote into the checkout: ${path}\n`);
  }
  build.out(`build:check: ${results.length} apps, ${failed.length} failed, ${written.length} writes\n`);
  return exitCode(isEmpty(failed) && isEmpty(written));
}

/**
 * Write or compare the generated blocks of the docs, complaining of each one left stale.
 *
 * @param {DocsRun} docs - Whether to compare only, the block writer and the report.
 * @returns {Promise<number>} The exit code: success when no block is left stale or unknown.
 */
async function genDocs(docs: Readonly<DocsRun>): Promise<number> {
  const left = await docs.run(docs.check);
  for (const problem of left) {
    docs.complain(`${problem.path}:${problem.line}: ${problem.message}`);
  }
  return exitCode(isEmpty(left));
}

/**
 * Hunt for flaky tests, reporting each failing copy and the command that replays the hunt.
 *
 * @param {StressRun} stress - The hunt's options, the hunter and the report.
 * @returns {Promise<number>} The exit code: success when every copy passed.
 */
async function stressHunt(stress: Readonly<StressRun>): Promise<number> {
  const { options } = stress;
  stress.out(`test:stress: base seed ${options.seed}, ${options.copies} copies, ${options.repeats} repeats\n`);
  const results = await stress.hunt(options);
  const failed = results.filter((result) => !succeeded(result));
  for (const result of failed) {
    stress.out(`seed ${result.seed} failed:\n${result.output}\n`);
  }
  stress.out(`test:stress: ${results.length - failed.length} of ${results.length} copies passed\n`);
  if (!isEmpty(failed)) {
    stress.out(`replay: pnpm run test:stress -- --seed ${options.seed} --copies ${options.copies} --repeats ${options.repeats}\n`);
  }
  return exitCode(isEmpty(failed));
}

/**
 * Refuse a pushed range holding a `fixup!`, `squash!` or `amend!` commit.
 *
 * @param {PushRun} push - The hook's input, the repository, the subject reader and the report.
 * @returns {Promise<number>} The exit code: success when no pushed commit asks to be folded.
 */
async function checkPushed(push: Readonly<PushRun>): Promise<number> {
  const found = await Promise.all(
    updates(push.stdin).map(async (update) => {
      const subjects = await push.subjects(revisions(update), push.cwd);
      return refused(subjects);
    }),
  );
  const all = found.flat();
  if (!isEmpty(all)) {
    push.complain(`fold these commits before pushing:\n${all.join('\n')}`);
  }
  return exitCode(isEmpty(all));
}

/**
 * Type-check every project at once, saying each failure and a summary.
 *
 * @param {TypecheckRun} typecheck - The projects, the checker and the report.
 * @returns {Promise<number>} The exit code: success when every project passed.
 */
async function typecheckAll(typecheck: Readonly<TypecheckRun>): Promise<number> {
  const outcomes = await Promise.all(
    typecheck.projects.map(async (project) => {
      const outcome = await typecheck.check(project, typecheck.root);
      return [project, outcome] as const;
    }),
  );
  const failed = outcomes.filter(([, outcome]: readonly [string, Finished]) => !succeeded(outcome));
  for (const [project, outcome] of failed) {
    typecheck.say(`${project}\n${outcome.stdout}${outcome.stderr}`);
  }
  typecheck.say(`typecheck: ${typecheck.projects.length} projects, ${failed.length} failed`);
  return exitCode(isEmpty(failed));
}

export { buildCheck, checkPushed, genDocs, stressHunt, typecheckAll };
export type { BuildRun, DocsRun, PushRun, Report, StressRun, TypecheckRun };
