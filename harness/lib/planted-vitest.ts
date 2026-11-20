/**
 * A planted Vitest run: a scratch project holding a copy of the harness library, a config that loads
 * the gate's guards, and planted spec files, run by the repository's locked Vitest in a fixed order.
 * A guard is proven by what this run reports for each planted test.
 */

import { json, object } from './config.ts';
import { Project } from './tools.ts';

/** The setup module the gate's Vitest config loads for every test. */
const GUARDS = 'harness/lib/vitest-setup/guards.ts';

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

/** Run planted spec files ({path under planted/: text}); each test's outcome by its full name. */
export function runPlanted(specs: Readonly<Record<string, string>>): ReadonlyMap<string, Outcome> {
  const project = new Project({ copies: ['harness/lib'] });
  try {
    project.write('vitest.config.ts', CONFIG);
    for (const [path, text] of Object.entries(specs)) {
      project.write(`planted/${path}`, text);
    }
    project.tool('vitest', 'run', '--reporter=json', '--outputFile=report.json');
    const report = object(json(project.read('report.json')), 'the Vitest report');
    const outcomes = new Map<string, Outcome>();
    for (const file of Array.isArray(report['testResults']) ? report['testResults'] : []) {
      const assertions = object(file, 'a test file result')['assertionResults'];
      for (const assertion of Array.isArray(assertions) ? assertions : []) {
        const fields = object(assertion, 'a test result');
        outcomes.set(String(fields['fullName']), {
          status: String(fields['status']),
          failure: strings(fields['failureMessages']).join('\n'),
        });
      }
    }
    return outcomes;
  } finally {
    project.remove();
  }
}
