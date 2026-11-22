/** Type-check every held TypeScript project with `tsc --noEmit`; exit non-zero if any fails. */

import { projects, typecheckProject } from '#lib/projects.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import { say } from '#lib/output.ts';
import { typecheckAll } from '#lib/script-entries.ts';

process.exitCode = await typecheckAll({ check: typecheckProject, projects: await projects(), root: REPO_ROOT, say });
