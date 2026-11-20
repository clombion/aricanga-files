/** Find copied code in the held TypeScript with jscpd; exit 1 on any problem (`harness/lib/dupes.ts`). */

import { main } from '../lib/dupes.ts';
import { err, out } from '../lib/output.ts';

process.exitCode = main({ err, out });
