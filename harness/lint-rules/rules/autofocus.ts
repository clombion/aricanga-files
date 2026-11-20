/** No `autofocus` in either spelling: jsx-a11y's no-autofocus sees React's `autoFocus`, not Solid's. */

import type { Rule } from '#lint-rules/ast.ts';
import { attributeRule } from '#lint-rules/jsx.ts';

export const autofocus: Rule = attributeRule(
  'No autofocus or autoFocus attribute; move focus on navigation instead.',
  (name) => name.toLowerCase() === 'autofocus',
  'no autofocus: move focus deliberately when the view changes',
);
