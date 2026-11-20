/** Hold the coverage floor on the gate's coverage run; exit 1 on any problem (`harness/lib/coverage.ts`). */

import { COVERAGE_DIR, DEBT, main } from '../lib/coverage.ts';

process.exitCode = main((text) => process.stderr.write(text), DEBT, COVERAGE_DIR);
