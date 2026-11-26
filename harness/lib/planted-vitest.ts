/**
 * A planted Vitest run: a scratch project holding a copy of the harness library, a config that loads
 * the gate's guards, and planted spec files, run by the repository's locked Vitest in a fixed order.
 * A guard is proven by what this run reports for each planted test.
 */

import { list, object, parsed, stringOf, strings } from './config.ts';
import { HARNESS_LIB } from './test-globs.ts';
import { Project } from './tools.ts';
import { typescriptGlob } from './source-files.ts';

/** The setup module the gate's Vitest config loads for every test. */
const GUARDS = `${HARNESS_LIB}guards.ts`;

/** What a planted test ended as, and why it failed if it did. */
interface Outcome {
  readonly status: string;
  readonly failure: string;
}

const CONFIG = `export default {
  test: {
    environment: 'node',
    include: ['${typescriptGlob('planted/**/*.test')}'],
    setupFiles: ['./${GUARDS}'],
    sequence: { shuffle: false },
    fileParallelism: false,
  },
};
`;

/**
 * Each test's outcome in a Vitest JSON report.
 *
 * @param {string} reportText - The report's text.
 * @returns {ReadonlyMap<string, Outcome>} Each test's outcome, by the test's full name.
 */
function outcomesOf(reportText: string): ReadonlyMap<string, Outcome> {
  const report = object(parsed(reportText, 'the Vitest report'), 'the Vitest report');
  const assertions = list(report['testResults'], 'the test file results').flatMap((file) =>
    list(object(file, 'a test file result')['assertionResults'], "a test file's results"),
  );
  return new Map(
    assertions.map((assertion) => {
      const fields = object(assertion, 'a test result');
      const outcome: Outcome = {
        failure: strings(fields['failureMessages'], "a test's failure messages").join('\n'),
        status: stringOf(fields['status'], "a test's status"),
      };
      return [stringOf(fields['fullName'], "a test's full name"), outcome] as const;
    }),
  );
}

/**
 * Run planted spec files.
 *
 * @param {Readonly<Record<string, string>>} specs - Each planted spec's text, by its path under the planted project's root.
 * @returns {Promise<ReadonlyMap<string, Outcome>>} Each test's outcome, by its full name.
 */
async function runPlanted(specs: Readonly<Record<string, string>>): Promise<ReadonlyMap<string, Outcome>> {
  const project = await Project.create({ copies: [HARNESS_LIB] });
  try {
    await project.write('vitest.config.ts', CONFIG);
    await project.writeAll(Object.entries(specs).map(([path, text]: readonly [string, string]) => [`planted/${path}`, text] as const));
    await project.tool('vitest', 'run', '--reporter=json', '--outputFile=report.json');
    const report = await project.read('report.json');
    return outcomesOf(report);
  } finally {
    await project.remove();
  }
}

export { runPlanted };
