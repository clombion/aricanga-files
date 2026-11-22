/**
 * The stylelint rule `harness/design-tokens`: a raw size is written only where a design token is
 * defined, a custom property declared in a `tokens.css`; and a custom property declared anywhere
 * else holds no raw size, colour, duration, easing or z-index. Raw colours, durations, timing
 * functions and z-indexes in ordinary declarations belong to the strict-value plugin's rule, which
 * does not read custom properties. Zero and unitless numbers are not raw.
 */

import type { Rule } from 'stylelint';
import { present } from './present.ts';
import stylelint from 'stylelint';

/** A raw value found: its kind and its text. */
type Raw = readonly [string, string];

/** How to find one kind of raw value. */
interface Finder {
  readonly kind: string;
  readonly pattern: Readonly<RegExp>;
  /** Whether a match whose number is zero is not raw. */
  readonly zeroIsFine: boolean;
}

const ruleName = 'harness/design-tokens';

const SIZE =
  /(?<![\w-])-?(?<number>\d*\.?\d+)(?<unit>px|rem|em|vh|vw|vi|vb|vmin|vmax|svh|lvh|dvh|dvi|dvb|svi|svb|ch|ex|lh|cqw|cqh|cqi|cqb|pt|pc|cm|mm|in)\b/gu;
const DURATION = /(?<![\w-])(?<number>\d*\.?\d+)(?<unit>ms|s)\b/gu;
const HEX = /#[\da-f]{3,8}\b/giu;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/giu;
const EASING_FUNCTION = /\b(?:cubic-bezier|steps)\(/giu;
const EASING_KEYWORD = /(?<![\w-])(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)(?![\w-])/gu;
const NAMED_COLOUR =
  /(?<![\w-])(?:black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|olive|lime|aqua|teal|navy|fuchsia|brown|gold|indigo|violet|cyan|magenta|beige|coral|crimson|salmon|tomato|khaki|lavender|plum|orchid|tan|wheat|ivory|azure|snow|linen)(?![\w-])/giu;
const INTEGER = /^-?\d+$/u;

/** The number zero, which is never a raw value. */
const ZERO = 0;

const SIZES: Finder = { kind: 'size', pattern: SIZE, zeroIsFine: true };

const TOKEN_FINDERS: readonly Finder[] = [
  SIZES,
  { kind: 'duration', pattern: DURATION, zeroIsFine: true },
  { kind: 'colour', pattern: HEX, zeroIsFine: false },
  { kind: 'colour', pattern: COLOUR_FUNCTION, zeroIsFine: false },
  { kind: 'colour', pattern: NAMED_COLOUR, zeroIsFine: false },
  { kind: 'easing', pattern: EASING_FUNCTION, zeroIsFine: false },
  { kind: 'easing', pattern: EASING_KEYWORD, zeroIsFine: false },
];

const messages: { raw: (kind: string, value: string) => string } = stylelint.utils.ruleMessages(ruleName, {
  raw: (kind: string, value: string) => `raw ${kind} "${value}" outside the design tokens: read a token with var()`,
});

/**
 * The raw values one finder finds in a declaration's value.
 *
 * @param {Finder} finder - What to look for.
 * @param {string} value - The declaration's value.
 * @returns {Raw[]} Each raw value found, with its kind.
 */
function found(finder: Finder, value: string): Raw[] {
  const raws: Raw[] = [];
  for (const match of value.matchAll(finder.pattern)) {
    const [text] = match;
    if (!finder.zeroIsFine || Number(match.groups?.['number']) !== ZERO) {
      raws.push([finder.kind, text]);
    }
  }
  return raws;
}

/**
 * The raw sizes of a declaration's value.
 *
 * @param {string} value - The declaration's value.
 * @returns {readonly Raw[]} Each raw size, with its kind.
 */
function rawSizes(value: string): readonly Raw[] {
  return found(SIZES, value);
}

/**
 * Every raw design value of a custom property's value: size, duration, colour, easing or a bare integer.
 *
 * @param {string} value - The custom property's value.
 * @returns {readonly Raw[]} Each raw value, with its kind.
 */
function rawTokenValues(value: string): readonly Raw[] {
  const integer = value.trim();
  const zIndex: readonly Raw[] = INTEGER.test(integer) && Number(integer) !== ZERO ? [['z-index', integer]] : [];
  return [...TOKEN_FINDERS.flatMap((finder) => found(finder, value)), ...zIndex];
}

/**
 * The raw design values a declaration holds that the rule reports: a declaration's raw sizes, and a
 * custom property's raw values outside the token file, where a token defines them.
 *
 * @param {string} property - The declared property.
 * @param {string} value - Its value.
 * @param {boolean} tokenFile - Whether the sheet is the token file.
 * @returns {readonly Raw[]} The raw values to report.
 */
function reported(property: string, value: string, tokenFile: boolean): readonly Raw[] {
  if (!property.startsWith('--')) {
    return rawSizes(value);
  }
  return tokenFile ? [] : rawTokenValues(value);
}

const rule: Rule = () => (root, result) => {
  const tokenFile = present(root.source?.input.file, 'the file name of the sheet stylelint lints').endsWith('tokens.css');
  root.walkDecls((declaration) => {
    for (const [kind, value] of reported(declaration.prop, declaration.value, tokenFile)) {
      stylelint.utils.report({ message: messages.raw(kind, value), node: declaration, result, ruleName, word: value });
    }
  });
};
rule.ruleName = ruleName;
rule.messages = messages;

const plugin: ReturnType<typeof stylelint.createPlugin> = stylelint.createPlugin(ruleName, rule);

export { messages, rawSizes, rawTokenValues, reported, ruleName };
// Stylelint loads a plugin module's default export.
export default plugin;
