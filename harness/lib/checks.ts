/** The shipped checks: every check module that declares a `HARNESS_ID`, with its doc comment's first line. */

import { textOf, tracked } from './source-files.ts';

interface CheckModule {
  readonly harnessId: string;
  readonly path: string;
  readonly summary: string;
}

const DECLARED = /^(?:export )?const HARNESS_ID = '(?<id>[a-z0-9-]+)';$/mu;
const LEADING_DOC = /^\/\*\*\s*\n?\s*\*?\s*(.+?)\s*(?:\n|\*\/)/;

/** The `HARNESS_ID` a module's source declares, if any. */
function declaredId(text: string): string | undefined {
  return DECLARED.exec(text)?.groups?.['id'];
}

/** The first line of a module's leading doc comment. */
function summary(text: string): string {
  return LEADING_DOC.exec(text)?.[1] ?? '';
}

/** Every listed check module declaring a `HARNESS_ID`, sorted by id. */
export function checkModules(): readonly CheckModule[] {
  return tracked()
    .filter((path) => path.startsWith('harness/checks/') && path.endsWith('.test.ts'))
    .flatMap((path) => {
      const text = textOf(path);
      const harnessId = declaredId(text);
      return harnessId === undefined ? [] : [{ harnessId, path, summary: summary(text) }];
    })
    .toSorted((a, b) => a.harnessId.localeCompare(b.harnessId) || a.path.localeCompare(b.path));
}
