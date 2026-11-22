/** The gate's product build: every held Vite app builds in check mode and writes nothing into the checkout. */

import { apps, checkBuild } from '#lib/build.ts';
import { buildCheck } from '#lib/script-entries.ts';
import { out } from '#lib/output.ts';

process.exitCode = await buildCheck({ apps: await apps(), check: checkBuild, out });
