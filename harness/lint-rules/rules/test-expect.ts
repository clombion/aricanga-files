/**
 * A test asserts with its context's `expect`, never the one `vitest` exports: the exported one counts the assertions of
 * every test running beside it, so `hasAssertions` and `assertions` lie under concurrent tests (`test:stress`).
 */

import { onImports, refuse } from '#lint-rules/rules/imports.ts';
import type { Rule } from '#lint-rules/ast.ts';
import { problemMeta } from '#lint-rules/ast.ts';

export const testExpect: Rule = {
  create(context) {
    return onImports((imported) => {
      if (imported.source === 'vitest' && imported.names.includes('expect')) {
        refuse(context, imported, "assert with the test context's expect, not the one vitest exports");
      }
    });
  },
  meta: problemMeta("A test asserts with its context's expect, never the one vitest exports."),
};
