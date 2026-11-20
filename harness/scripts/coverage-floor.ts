/** Hold the coverage floor on the gate's coverage run; exit 1 on any problem (`harness/lib/coverage.ts`). */

import { main } from '../lib/coverage.ts';

process.exitCode = main((text) => process.stderr.write(text));
