/** Hold the coverage floor on the gate's coverage run; exit 1 on any problem (`harness/lib/coverage.ts`). */

import { COVERAGE_DIR, DEBT, main } from '../lib/coverage.ts';
import { err } from '../lib/output.ts';

process.exitCode = main(err, DEBT, COVERAGE_DIR);
