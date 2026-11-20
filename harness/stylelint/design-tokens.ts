/**
 * The stylelint rule `harness/design-tokens`: a raw size, colour, duration, easing or z-index is
 * written only where a design token is defined, a custom property declared in a `tokens.css`.
 * Everywhere else, a value reads its token through `var()`. Zero and unitless numbers are not raw.
 */

import stylelint, { type Rule } from 'stylelint';

export const ruleName = 'harness/design-tokens';

const SIZE = /(?<![\w-])-?(\d*\.?\d+)(px|rem|em|vh|vw|vmin|vmax|svh|lvh|dvh|ch|ex|lh|cqw|cqh|pt|pc|cm|mm|in)\b/g;
const DURATION = /(?<![\w-])(\d*\.?\d+)(ms|s)\b/g;
const HEX = /#[\da-f]{3,8}\b/gi;
const COLOUR_FUNCTION = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const EASING_FUNCTION = /\b(cubic-bezier|steps)\(/gi;
const EASING_KEYWORD = /(?<![\w-])(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)(?![\w-])/g;
const TIMING_PROPERTY = /^(transition|animation)(-timing-function)?$/;
const NAMED_COLOUR =
  /(?<![\w-])(black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|olive|lime|aqua|teal|navy|fuchsia|brown|gold|indigo|violet|cyan|magenta|beige|coral|crimson|salmon|tomato|khaki|lavender|plum|orchid|tan|wheat|ivory|azure|snow|linen)(?![\w-])/gi;

export const messages = stylelint.utils.ruleMessages(ruleName, {
  raw: (kind: string, value: string) => `raw ${kind} "${value}" outside the design tokens: read a token with var()`,
});

/** The raw values of one declaration: [kind, the value written]. */
export function rawValues(property: string, value: string): readonly (readonly [string, string])[] {
  const found: (readonly [string, string])[] = [];
  const nonZero = (pattern: RegExp, kind: string): void => {
    for (const match of value.matchAll(pattern)) {
      if (Number(match[1]) !== 0) {
        found.push([kind, match[0]]);
      }
    }
  };
  const every = (pattern: RegExp, kind: string): void => {
    for (const match of value.matchAll(pattern)) {
      found.push([kind, match[0]]);
    }
  };
  nonZero(SIZE, 'size');
  nonZero(DURATION, 'duration');
  every(HEX, 'colour');
  every(COLOUR_FUNCTION, 'colour');
  every(NAMED_COLOUR, 'colour');
  every(EASING_FUNCTION, 'easing');
  if (TIMING_PROPERTY.test(property)) {
    every(EASING_KEYWORD, 'easing');
  }
  if (property === 'z-index' && !/^(var\(|auto$|inherit$|initial$|unset$)/.test(value.trim())) {
    found.push(['z-index', value.trim()]);
  }
  return found;
}

const rule: Rule = (primary) => (root, result) => {
  if (primary !== true) {
    return;
  }
  const file = root.source?.input.file ?? '';
  const tokenFile = file.endsWith('tokens.css');
  root.walkDecls((declaration) => {
    if (tokenFile && declaration.prop.startsWith('--')) {
      return;
    }
    for (const [kind, value] of rawValues(declaration.prop, declaration.value)) {
      stylelint.utils.report({
        ruleName,
        result,
        node: declaration,
        message: messages.raw(kind, value),
        word: value,
      });
    }
  });
};
rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
