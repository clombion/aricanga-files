/** Hold the coverage floor on the gate's coverage run; exit 1 on any problem (`harness/lib/coverage.ts`). */

import { fileCoverage, floorProblems, gateReport } from '../lib/coverage.ts';

const problems = floorProblems(fileCoverage(gateReport()));
process.stderr.write(problems.map((problem) => `${problem}\n`).join(''));
process.exitCode = problems.length === 0 ? 0 : 1;
