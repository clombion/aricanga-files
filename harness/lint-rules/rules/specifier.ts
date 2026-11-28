/** A module is named by a string: a template, even with no substitution, is a name the role matrix's name lint cannot read. */

import { child, problemMeta } from '#lint-rules/ast.ts';
import type { Rule } from '#lint-rules/ast.ts';

export const specifier: Rule = {
  create(context) {
    return {
      ImportExpression(node) {
        if (child(node, 'source')?.type === 'TemplateLiteral') {
          context.report({ message: 'name the module by a string, not a template', node });
        }
      },
    };
  },
  meta: problemMeta('A module is named by a string, never a template.'),
};
