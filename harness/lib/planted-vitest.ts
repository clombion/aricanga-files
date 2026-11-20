/**
 * A planted Vitest run: a scratch project holding a copy of the harness library, a config that loads
 * the gate's guards, and planted spec files, run by the repository's locked Vitest in a fixed order.
 * A guard is proven by what this run reports for each planted test.
 */

import { json, object } from './config.ts';
import { Project } from './tools.ts';

/** The setup module the gate's Vitest config loads for every test. */
const GUARDS = 'harness/lib/guards.ts';

/** What a planted test ended as, and why it failed if it did. */
interface Outcome {
  readonly status: string;
  readonly failure: string;
}

const CONFIG = `export default {
  test: {
    environment: 'node',
    include: ['planted/**/*.test.ts'],
    setupFiles: ['./${GUARDS}'],
    sequence: { shuffle: false },
    fileParallelism: false,
  },
};
`;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Each test's outcome in a Vitest JSON report.
 *
 * @param {string} reportText - The report's text.
 * @returns {ReadonlyMap<string, Outcome>} Each test's outcome, by the test's full name.
 */
function outcomesOf(reportText: string): ReadonlyMap<string, Outcome> {
  const report = object(json(reportText), 'the Vitest report');
  const assertions = list(report['testResults']).flatMap((file) =>
    list(object(file, 'a test file result')['assertionResults']),
  );
  return new Map(
    assertions.map((assertion) => {
      const fields = object(assertion, 'a test result');
      const outcome: Outcome = {
        failure: strings(fields['failureMessages']).join('\n'),
        status: String(fields['status']),
      };
      return [String(fields['fullName']), outcome] as const;
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
  const project = await Project.create({ copies: ['harness/lib'] });
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
