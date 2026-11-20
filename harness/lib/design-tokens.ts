/**
 * The stylelint rule `harness/design-tokens`: a raw size is written only where a design token is
 * defined, a custom property declared in a `tokens.css`; and a custom property declared anywhere
 * else holds no raw size, colour, duration, easing or z-index. Raw colours, durations, timing
 * functions and z-indexes in ordinary declarations belong to the strict-value plugin's rule, which
 * does not read custom properties. Zero and unitless numbers are not raw.
 */

import stylelint, { type Rule } from 'stylelint';

export const ruleName: string = 'harness/design-tokens';

const SIZE = /(?<![\w-])-?(\d*\.?\d+)(px|rem|em|vh|vw|vi|vb|vmin|vmax|svh|lvh|dvh|dvi|dvb|svi|svb|ch|ex|lh|cqw|cqh|cqi|cqb|pt|pc|cm|mm|in)\b/g;
const DURATION = /(?<![\w-])(\d*\.?\d+)(ms|s)\b/g;
const HEX = /#[\da-f]{3,8}\b/gi;
const COLOUR_FUNCTION = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const EASING_FUNCTION = /\b(cubic-bezier|steps)\(/gi;
const EASING_KEYWORD = /(?<![\w-])(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)(?![\w-])/g;
const NAMED_COLOUR =
  /(?<![\w-])(black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|olive|lime|aqua|teal|navy|fuchsia|brown|gold|indigo|violet|cyan|magenta|beige|coral|crimson|salmon|tomato|khaki|lavender|plum|orchid|tan|wheat|ivory|azure|snow|linen)(?![\w-])/gi;
const INTEGER = /^-?\d+$/;

export const messages: { raw: (kind: string, value: string) => string } = stylelint.utils.ruleMessages(ruleName, {
  raw: (kind: string, value: string) => `raw ${kind} "${value}" outside the design tokens: read a token with var()`,
});

function matches(pattern: RegExp, value: string, kind: string, nonZero: boolean): (readonly [string, string])[] {
  return [...value.matchAll(pattern)]
    .filter((match) => !nonZero || Number(match[1]) !== 0)
    .map((match) => [kind, match[0]] as const);
}

/** The raw sizes of a declaration's value. */
export function rawSizes(value: string): readonly (readonly [string, string])[] {
  return matches(SIZE, value, 'size', true);
}

/** Every raw design value of a custom property's value: size, duration, colour, easing or a bare integer. */
export function rawTokenValues(value: string): readonly (readonly [string, string])[] {
  return [
    ...rawSizes(value),
    ...matches(DURATION, value, 'duration', true),
    ...matches(HEX, value, 'colour', false),
    ...matches(COLOUR_FUNCTION, value, 'colour', false),
    ...matches(NAMED_COLOUR, value, 'colour', false),
    ...matches(EASING_FUNCTION, value, 'easing', false),
    ...matches(EASING_KEYWORD, value, 'easing', false),
    ...(INTEGER.test(value.trim()) && Number(value) !== 0 ? [['z-index', value.trim()] as const] : []),
  ];
}

const rule: Rule = (primary) => (root, result) => {
  if (primary !== true) {
    return;
  }
  const tokenFile = (root.source?.input.file ?? '').endsWith('tokens.css');
  root.walkDecls((declaration) => {
    const custom = declaration.prop.startsWith('--');
    if (tokenFile && custom) {
      return;
    }
    const found = custom ? rawTokenValues(declaration.value) : rawSizes(declaration.value);
    for (const [kind, value] of found) {
      stylelint.utils.report({ ruleName, result, node: declaration, message: messages.raw(kind, value), word: value });
    }
  });
};
rule.ruleName = ruleName;
rule.messages = messages;

const plugin: ReturnType<typeof stylelint.createPlugin> = stylelint.createPlugin(ruleName, rule);
export default plugin;
