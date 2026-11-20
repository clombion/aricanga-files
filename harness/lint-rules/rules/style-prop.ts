/** No `style` prop: the compiler writes an inline style attribute, which the CSP refuses. */

import { attributeRule, type Rule } from '../ast.ts';

export const styleProp: Rule = attributeRule(
  'No style prop in JSX; set dynamic values with a class or a ref.',
  (name) => name === 'style',
  'no style prop: the CSP refuses inline styles; use a class or style.setProperty from a ref',
);
