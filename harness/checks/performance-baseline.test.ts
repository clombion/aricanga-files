/** The performance baseline folds every run's reports into each project's slowest timings, and writes them sorted. */

import { BASELINE, RUN_ARGUMENTS, recordBaseline, timingOf } from '#lib/performance-baseline.ts';
import { Project, finished } from '#lib/tools.ts';
import { afterEach, describe, expect, test } from 'vitest';
import { object, parsed, stringOf } from '#lib/config.ts';
import { EXIT_SUCCESS } from '#lib/output.ts';
import type { Finished } from '#lib/process.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import { Scripted } from '#lib/doubles.ts';
import { textOf } from '#lib/source-files.ts';

/** The first scripted run, and the step to the next. */
const FIRST_RUN = 0;
const NEXT_RUN = 1;

/** The arguments after the runner's binary. */
const AFTER_BINARY = 1;

/**
 * The projects the performance spec's configuration runs, as Playwright lists them.
 *
 * @returns {Promise<readonly string[]>} Their names, sorted.
 */
async function configuredProjects(): Promise<readonly string[]> {
  const listed = await finished([...RUN_ARGUMENTS, '--list', '--reporter=json'], { cwd: REPO_ROOT });
  const { config: listedConfig } = object(parsed(listed.stdout, 'the listing'), 'the listing');
  const { projects } = object(listedConfig, 'the listed config');
  if (!Array.isArray(projects)) {
    throw new TypeError(`the listed config holds no projects: ${listed.stdout}`);
  }
  return projects.map((project: unknown) => stringOf(object(project, 'a listed project')['name'], 'a listed project name')).toSorted();
}

/** The planted projects not yet removed. */
const planted: Project[] = [];

/** Two runs of the spec, as the files each leaves in the results directory. */
const RUN_FILES: readonly (readonly (readonly [string, string])[])[] = [
  [
    ['chromium/performance.json', '{"project":"chromium","render":10,"updates":50}'],
    ['webkit/performance.json', '{"project":"webkit","render":30,"updates":90}'],
    ['other-spec/result.txt', 'not a performance report'],
    ['odd/performance.json', '{"project":1,"render":2,"updates":3}'],
  ],
  [['chromium/performance.json', '{"project":"chromium","render":12,"updates":40}']],
];

/**
 * A planted results directory, removed after the test.
 *
 * @returns {Promise<Project>} The directory.
 */
async function results(): Promise<Project> {
  const project = await Project.create({ linkModules: false });
  planted.push(project);
  return project;
}

/**
 * A stand-in for the spec's runner: each scripted run writes its reports into the results directory,
 * and a run past the scripted ones trips.
 *
 * @param {Project} directory - The results directory.
 * @param {Scripted<string>} runs - The scripted run numbers, by call.
 * @returns {(argv: readonly string[]) => Promise<Finished>} The runner.
 */
function runner(
  directory: Readonly<Project>,
  runs: Readonly<Pick<Scripted<string>, 'answer'>>,
): (argv: readonly string[]) => Promise<Finished> {
  let index = FIRST_RUN;
  return async (argv: readonly string[]): Promise<Finished> => {
    const run = Number(runs.answer(`run ${String(index)}`));
    index += NEXT_RUN;
    await directory.writeAll(RUN_FILES.at(run) ?? []);
    return { argv, kind: 'finished', status: EXIT_SUCCESS, stderr: '', stdout: '' };
  };
}

describe('a recorded baseline', () => {
  afterEach(async () => {
    await Promise.all(
      planted.splice(FIRST_RUN).map(async (project) => {
        await project.remove();
      }),
    );
  });

  test("keeps each project's slowest render and updates across runs, sorted by project", async () => {
    expect.hasAssertions();
    const directory = await results();
    const written = new Map<string, string>();
    const said: string[] = [];
    const runs = new Scripted({ 'run 0': '0', 'run 1': '1' });
    await recordBaseline({
      out: (text) => {
        said.push(text);
      },
      results: directory.root,
      root: '/planted',
      run: runner(directory, runs),
      runs: 2,
      write: async (relative, text) => {
        written.set(relative, await Promise.resolve(text));
      },
    });
    expect(Object.fromEntries(written)).toStrictEqual({
      [BASELINE]:
        '{\n  "chromium": {\n    "render": 12,\n    "updates": 50\n  },\n  "webkit": {\n    "render": 30,\n    "updates": 90\n  }\n}\n',
    });
    expect(said).toStrictEqual(['performance run exited 0\n', 'performance run exited 0\n', 'baseline written for chromium, webkit\n']);
    expect(runs.calls).toStrictEqual(['run 0', 'run 1']);
  });

  test('runs the performance spec alone on one worker', () => {
    expect.hasAssertions();
    expect(RUN_ARGUMENTS.slice(AFTER_BINARY)).toStrictEqual([
      'test',
      '-c',
      'packages/characterisation/playwright.characterisation.config.ts',
      '--grep',
      '@performance',
      '--workers=1',
    ]);
  });
});

describe('the committed baseline', () => {
  test('names exactly the projects the performance spec runs in', async () => {
    expect.hasAssertions();
    const recorded = object(parsed(await textOf(BASELINE), BASELINE), BASELINE);
    const baseline = Object.keys(recorded).toSorted();
    await expect(configuredProjects()).resolves.toStrictEqual(baseline);
  });
});

describe('a performance report', () => {
  test('gives its project and timing', () => {
    expect.hasAssertions();
    expect(timingOf('{"project":"firefox","render":5,"updates":6}')).toStrictEqual(['firefox', { render: 5, updates: 6 }]);
  });

  test.each([
    ['a number', '3'],
    ['null', 'null'],
    ['an object missing its project', '{"render":1,"updates":2}'],
    ['an object missing its render', '{"project":"x","updates":2}'],
    ['an object missing its updates', '{"project":"x","render":1}'],
    ['a project that is no text', '{"project":1,"render":1,"updates":2}'],
    ['a render that is no number', '{"project":"x","render":"1","updates":2}'],
    ['updates that are no number', '{"project":"x","render":1,"updates":"2"}'],
  ])('of another shape, %s, is no timing', (_shape, text) => {
    expect.hasAssertions();
    expect(timingOf(text)).toBeUndefined();
  });
});
