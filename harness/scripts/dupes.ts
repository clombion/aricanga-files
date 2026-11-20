/** Find copied code in the held TypeScript with jscpd; exit 1 on any problem (`harness/lib/dupes.ts`). */

import { main } from '../lib/dupes.ts';

process.exitCode = main({ out: (text) => process.stdout.write(text), err: (text) => process.stderr.write(text) });
