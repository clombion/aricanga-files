/**
 * The coverage floor fails an untaken branch, an uncalled function and an unrun line, on all four metrics, and its debt fails both ways.
 *
 * The plants run Vitest with v8 coverage in a planted project and read the Istanbul report the way
 * `harness/scripts/coverage-floor.ts` reads the gate's: every line and branch taken passes; a
 * dropped case or an uncalled function is a shortfall of its file and metric; a registered debt
 * passes its exact shortfall and fails once the gap closes or grows. The gate's config writes the
 * report the script reads.
 */

import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { object } from '../lib/config.ts';
import {
  COVERAGE_DIR,
  DEBT,
  type FileCoverage,
  fileCoverage,
  floorProblems,
  gateReport,
  main,
  shortfalls,
} from '../lib/coverage.ts';
import { CountedExemptions, site } from '../lib/exemptions.ts';
import { tracked } from '../lib/source-files.ts';
import { Project } from '../lib/tools.ts';
import gate from '../../vitest.gate.config.ts';

export const HARNESS_ID = 'coverage-floor';

const BRANCHY = "export function sign(value: number): string {\n  if (value < 0) {\n    return 'negative';\n  }\n  return 'positive';\n}\n";
const UNCALLED = "export function used(): number {\n  return 1;\n}\nexport function unused(): number {\n  return 2;\n}\n";
const CONFIG = `export default {
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', reportsDirectory: 'coverage', reporter: ['json'], include: ['src/**'] },
  },
};
`;
const FULL = `import { expect, test } from 'vitest';
import { sign } from '../src/branchy';
import { unused, used } from '../src/uncalled';
test('all', () => {
  expect([sign(-1), sign(1), used(), unused()]).toEqual(['negative', 'positive', 1, 2]);
});
`;

/** The coverage of a planted project whose test is `tests`. */
function planted(tests: string): readonly FileCoverage[] {
  const project = new Project();
  try {
    project.write('vitest.config.ts', CONFIG);
    project.write('src/branchy.ts', BRANCHY);
    project.write('src/uncalled.ts', UNCALLED);
    project.write('tests/plant.test.ts', tests);
    const done = project.tool('vitest', 'run', '--coverage');
    expect(done.status, done.stdout + done.stderr).toBe(0);
    return fileCoverage(gateReport(join(project.root, 'coverage')), project.root);
  } finally {
    project.remove();
  }
}

const NONE = new CountedExemptions({});

/** The files a debt names that the listing does not hold. */
function unlisted(debt: CountedExemptions): readonly string[] {
  const files = new Set(tracked());
  return [...debt.entries.keys()].map((key) => key.split(' :: ')[0] ?? key).filter((path) => !files.has(path));
}

describe('the floor', () => {
  test('passes every line, branch and function taken', () => {
    const files = planted(FULL);
    expect(files.map((file) => file.path)).toEqual(['src/branchy.ts', 'src/uncalled.ts']);
    expect(floorProblems(files, NONE)).toEqual([]);
  });

  test('fails an untaken branch on its statements, branches and lines', () => {
    const files = planted(FULL.replace('sign(-1), ', '').replace("'negative', ", ''));
    expect(floorProblems(files, NONE)).toEqual([
      'src/branchy.ts :: branches: 1 items under the 100 % floor, 0 registered',
      'src/branchy.ts :: lines: 1 items under the 100 % floor, 0 registered',
      'src/branchy.ts :: statements: 1 items under the 100 % floor, 0 registered',
    ]);
  });

  test('fails an uncalled function on its functions, statements and lines', () => {
    const files = planted(FULL.replace(', unused()]', ']').replace(', 2]', ']'));
    expect(floorProblems(files, NONE)).toEqual([
      'src/uncalled.ts :: functions: 1 items under the 100 % floor, 0 registered',
      'src/uncalled.ts :: lines: 1 items under the 100 % floor, 0 registered',
      'src/uncalled.ts :: statements: 1 items under the 100 % floor, 0 registered',
    ]);
  });
});

describe('the debt', () => {
  const file: FileCoverage = {
    path: 'src/a.ts',
    total: { statements: 4, branches: 2, functions: 1, lines: 4 },
    covered: { statements: 2, branches: 2, functions: 1, lines: 3 },
  };

  test('passes its exact shortfall', () => {
    const debt = new CountedExemptions({
      [site('src/a.ts', 'statements')]: [2, 'planted'],
      [site('src/a.ts', 'lines')]: [1, 'planted'],
    });
    expect(floorProblems([file], debt)).toEqual([]);
  });

  test('fails once the gap closes, and once it grows', () => {
    const closed = { ...file, covered: { ...file.covered, statements: 3 } };
    const debt = new CountedExemptions({
      [site('src/a.ts', 'statements')]: [2, 'planted'],
      [site('src/a.ts', 'lines')]: [1, 'planted'],
    });
    expect(floorProblems([closed], debt)).toEqual([
      'src/a.ts :: statements: 1 items under the floor, but 2 registered: lower the debt',
    ]);
    const grown = { ...file, covered: { ...file.covered, branches: 1 } };
    expect(floorProblems([grown], debt)).toEqual(['src/a.ts :: branches: 1 items under the 100 % floor, 0 registered']);
  });

  test('a lower floor is a fraction of the items', () => {
    expect(shortfalls([file], 50)).toEqual([]);
    expect(shortfalls([file], 75)).toEqual([site('src/a.ts', 'statements')]);
  });

  test('names only files the listing holds', () => {
    expect(unlisted(DEBT)).toEqual([]);
  });
});

describe('the gate', () => {
  test('writes the Istanbul JSON report the script reads, outside the checkout', () => {
    const coverage = object(object(object(gate, 'vitest.gate.config.ts')['test'] ?? {}, 'test')['coverage'] ?? {}, 'coverage');
    const reporters = Array.isArray(coverage['reporter']) ? coverage['reporter'] : [];
    expect([coverage['reportsDirectory'], reporters.includes('json')]).toEqual([COVERAGE_DIR, true]);
  });

  test('the script exits 0 on a report with no shortfall', () => {
    const project = new Project({ linkModules: false });
    try {
      project.write('coverage-final.json', JSON.stringify({}));
      const errors: string[] = [];
      expect([main((text) => errors.push(text), NONE, project.root), errors]).toEqual([0, []]);
    } finally {
      project.remove();
    }
  });

  test('the script exits 1 on a report with a shortfall and writes each problem', () => {
    const project = new Project({ linkModules: false });
    try {
      project.write(
        'coverage-final.json',
        JSON.stringify({
          [join(project.root, 'src/a.ts')]: { s: { '0': 0 }, b: {}, f: {}, statementMap: { '0': { start: { line: 1 } } } },
        }),
      );
      const errors: string[] = [];
      expect([main((text) => errors.push(text), NONE, project.root), errors.length]).toEqual([1, 2]);
    } finally {
      project.remove();
    }
  });
});
