/** What the `stylesheets` check plants: one sheet per rule `.stylelintrc.json` turns on, that the rule must fail, and a near miss every rule passes. */

/** A planted case: the rule, a sheet it must fail, and a near miss every rule passes. */
type Plant = readonly [rule: string, failing: string, passing: string];

/** The block a sheet with motion adds so `a11y/media-prefers-reduced-motion` passes. */
const RM = '\n\n@media (prefers-reduced-motion: reduce) {\n  .a {\n    transition: none;\n  }\n}\n';

/** The block a sheet with an animation adds so `a11y/media-prefers-reduced-motion` passes. */
const STILL = '\n\n@media (prefers-reduced-motion: reduce) {\n  .a {\n    animation: none;\n  }\n}\n';

/**
 * A one-declaration rule on `.a`.
 *
 * @param {string} declaration - The declaration, without its semicolon.
 * @returns {string} The sheet.
 */
function on(declaration: string): string {
  return `.a {\n  ${declaration};\n}\n`;
}

/**
 * A one-declaration rule on a selector.
 *
 * @param {string} selector - The selector.
 * @returns {string} The sheet.
 */
function rule(selector: string): string {
  return `${selector} {\n  color: var(--x);\n}\n`;
}

/** The rules a Biome rule maps to (docs/concepts/lint-rules.md), each held by a plant. */
const FROM_BIOME: readonly Plant[] = [
  [
    'at-rule-descriptor-value-no-unknown',
    '@font-face {\n  font-family: Plant;\n  font-display: sometimes;\n  src: url("a.woff2");\n}\n',
    '@font-face {\n  font-family: Plant;\n  font-display: swap;\n  src: url("a.woff2");\n}\n',
  ],
  ['at-rule-no-unknown', `@unknown {\n${rule('.a')}}\n`, `@media (width >= 40rem) {\n${rule('.a')}}\n`],
  ['block-no-empty', '.a {\n}\n', rule('.a')],
  [
    'custom-property-no-missing-var-function',
    ':root {\n  --x: var(--y);\n}\n\n.a {\n  color: --x;\n}\n',
    ':root {\n  --x: var(--y);\n}\n\n.a {\n  color: var(--x);\n}\n',
  ],
  ['declaration-block-no-duplicate-custom-properties', '.a {\n  --x: var(--y);\n  --x: var(--z);\n}\n', '.a {\n  --x: var(--y);\n}\n'],
  ['declaration-block-no-duplicate-properties', '.a {\n  color: var(--x);\n  color: var(--y);\n}\n', rule('.a')],
  [
    'declaration-block-no-shorthand-property-overrides',
    '.a {\n  background-color: var(--x);\n  background: var(--y);\n}\n',
    '.a {\n  background: var(--y);\n  background-color: var(--x);\n}\n',
  ],
  ['font-family-no-duplicate-names', on('font-family: var(--x), serif, serif'), on('font-family: var(--x), serif')],
  ['font-family-no-missing-generic-family-keyword', on('font-family: Inter'), on('font-family: Inter, sans-serif')],
  [
    'function-linear-gradient-no-nonstandard-direction',
    on('background-image: linear-gradient(top, var(--x), var(--y))'),
    on('background-image: linear-gradient(to top, var(--x), var(--y))'),
  ],
  ['function-no-unknown', on('inline-size: calcc(var(--x) + var(--y))'), on('inline-size: calc(var(--x) + var(--y))')],
  [
    'keyframe-block-no-duplicate-selectors',
    '@keyframes fade {\n  from {\n    opacity: 0;\n  }\n\n  from {\n    opacity: 1;\n  }\n}\n',
    '@keyframes fade {\n  from {\n    opacity: 0;\n  }\n\n  to {\n    opacity: 1;\n  }\n}\n',
  ],
  [
    'keyframe-declaration-no-important',
    '@keyframes fade {\n  from {\n    opacity: 0 !important;\n  }\n}\n',
    '@keyframes fade {\n  from {\n    opacity: 0;\n  }\n}\n',
  ],
  ['length-zero-no-unit', on('margin-inline: 0rem'), on('margin-inline: 0')],
  ['media-feature-name-no-unknown', `@media (widht >= 40rem) {\n${rule('.a')}}\n`, `@media (width >= 40rem) {\n${rule('.a')}}\n`],
  ['media-type-no-deprecated', `@media tv {\n${rule('.a')}}\n`, `@media screen {\n${rule('.a')}}\n`],
  ['named-grid-areas-no-invalid', on('grid-template-areas: "a a" "b"'), on('grid-template-areas: "a a" "b b"')],
  ['no-duplicate-at-import-rules', '@import url("a.css");\n@import url("a.css");\n', '@import url("a.css");\n'],
  ['no-invalid-position-at-import-rule', `${rule('.a')}\n@import url("a.css");\n`, `@import url("a.css");\n\n${rule('.a')}`],
  ['property-no-unknown', on('colr: var(--x)'), rule('.a')],
  ['selector-anb-no-unmatchable', rule('.a:nth-child(0n)'), rule('.a:nth-child(odd)')],
  ['selector-pseudo-class-no-unknown', rule('.a:hovr'), rule('.a:focus-visible')],
  ['selector-pseudo-element-no-unknown', '.a::befor {\n  content: "";\n}\n', '.a::before {\n  content: "";\n}\n'],
  ['selector-type-no-unknown', rule('unknown-element'), rule('.a')],
  ['unit-no-unknown', on('inline-size: 10pixels'), on('inline-size: 50%')],
];

/** The rules stricter than Biome and the standard config, each held by a plant. */
const STRICTER: readonly Plant[] = [
  [
    'at-rule-property-required-list',
    '@property --size {\n  syntax: "<length>";\n  initial-value: 0;\n}\n',
    '@property --size {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0;\n}\n',
  ],
  ['color-no-hex', on('color: #fff'), rule('.a')],
  ['color-no-invalid-hex', on('color: #ggg'), rule('.a')],
  ['comment-word-disallowed-list', `/* TODO: tidy */\n${rule('.a')}`, `/* The card's surface. */\n${rule('.a')}`],
  ['display-notation', on('display: block flow'), on('display: block')],
  ['function-url-no-scheme-relative', on('background-image: url("//example.com/a.png")'), on('background-image: url("a.png")')],
  [
    'function-url-scheme-allowed-list',
    on('background-image: url("https://example.com/a.png")'),
    on('background-image: url("data:image/png;base64,AA==")'),
  ],
  ['media-feature-name-unit-allowed-list', `@media (width >= 640px) {\n${rule('.a')}}\n`, `@media (width >= 40rem) {\n${rule('.a')}}\n`],
  [
    'no-unknown-animations',
    `${on('animation-name: fade').trimEnd()}${STILL}`,
    `@keyframes fade {\n  from {\n    opacity: 0;\n  }\n}\n\n.a {\n  animation-name: fade;\n}${STILL}`,
  ],
  [
    'no-unknown-custom-media',
    `@media (--narrow) {\n${rule('.a')}}\n`,
    `@custom-media --narrow (max-width: 40rem);\n\n@media (--narrow) {\n${rule('.a')}}\n`,
  ],
  ['relative-selector-nesting-notation', '.a {\n  .b {\n    color: var(--x);\n  }\n}\n', '.a {\n  & .b {\n    color: var(--x);\n  }\n}\n'],
  ['selector-combinator-allowed-list', rule('.a + .b'), rule('.a > .b')],
  ['selector-max-attribute', rule('[hidden][inert]'), rule('[hidden]')],
  ['selector-max-class', rule('.a.b.c.d'), rule('.a.b')],
  ['selector-max-combinators', rule(':where(.a) :where(.b) :where(.c) .d'), rule(':where(.a) :where(.b) .c')],
  ['selector-max-pseudo-class', rule(':where(.a):hover:focus:active'), rule(':where(.a):hover:focus')],
  ['selector-max-type', rule('p'), rule('.a')],
  ['selector-max-universal', rule('.a > *'), rule('.a > .b')],
  ['selector-no-deprecated', rule(':-moz-any(.a, .b)'), rule(':is(.a, .b)')],
  ['selector-no-invalid', rule('.a:is(.b,)'), rule('.a:is(.b)')],
  ['selector-no-unmatchable', rule(':is(::before)'), rule(':is(.b)')],
  [
    'time-min-milliseconds',
    `.a {\n  transition-duration: var(--x);\n  transition-delay: 5ms;\n}${RM}`,
    `.a {\n  transition-duration: var(--x);\n  transition-delay: var(--y);\n}${RM}`,
  ],
  ['unit-allowed-list', on('inline-size: 10vmin'), on('inline-size: 50%')],
];

/** The rules held before the Biome removal, each held by a plant. */
const HELD: readonly Plant[] = [
  ['no-descending-specificity', `${rule('.b .a')}\n${rule('.a')}`, `${rule('.a')}\n${rule('.b .a')}`],
  ['selector-max-specificity', rule('.a .b .c'), rule('.a .b')],
  ['selector-max-compound-selectors', rule(':where(.a) :where(.b) :where(.c) :where(.d)'), rule(':where(.a) :where(.b) .c')],
  [
    'max-nesting-depth',
    '.a {\n  & .b {\n    & .c {\n      color: var(--x);\n    }\n  }\n}\n',
    '.a {\n  & .b {\n    color: var(--x);\n  }\n}\n',
  ],
  ['selector-max-id', rule('#a'), rule('.a')],
  ['selector-no-qualifying-type', rule('p.a'), rule('.a')],
  ['declaration-no-important', on('color: var(--x) !important'), rule('.a')],
  ['color-named', on('color: red'), on('color: var(--danger)')],
  ['font-weight-notation', on('font-weight: bold'), on('font-weight: 700')],
  ['declaration-property-unit-allowed-list', on('font-size: 120%'), on('inline-size: 50%')],
  ['logical-css/require-logical-properties', on('margin-left: 0'), on('margin-inline-start: 0')],
  ['logical-css/require-logical-keywords', on('float: left'), on('float: inline-start')],
  ['logical-css/require-logical-units', on('inline-size: 50vw'), on('inline-size: 50%')],
  ['plugin/no-unsupported-browser-features', on('initial-letter: 2'), on('display: grid')],
  ['scale-unlimited/declaration-strict-value', on('color: rgb(255 255 255)'), on('color: var(--ink)')],
  ['scale-unlimited/declaration-strict-value', on('z-index: 3'), on('z-index: var(--layer-top)')],
  [
    'scale-unlimited/declaration-strict-value',
    `${on('transition-duration: 200ms').trimEnd()}${RM}`,
    `${on('transition-duration: var(--quick)').trimEnd()}${RM}`,
  ],
  [
    'scale-unlimited/declaration-strict-value',
    `${on('transition-timing-function: ease-in').trimEnd()}${RM}`,
    `${on('transition-timing-function: var(--ease-out)').trimEnd()}${RM}`,
  ],
  ['a11y/content-property-no-static-value', '.a::before {\n  content: "New";\n}\n', '.a::before {\n  content: "";\n}\n'],
  ['a11y/font-size-is-readable', on('font-size: 12px'), on('font-size: var(--text-body)')],
  ['a11y/line-height-is-vertical-rhythmed', on('line-height: 1.2'), on('line-height: 1.5')],
  ['a11y/media-prefers-color-scheme', on('color: rgb(0 0 0)'), on('color: var(--ink)')],
  [
    'a11y/media-prefers-reduced-motion',
    on('transition: opacity var(--quick) var(--ease-out)'),
    `${on('transition: opacity var(--quick) var(--ease-out)').trimEnd()}${RM}`,
  ],
  ['a11y/no-display-none', on('display: none'), on('display: block')],
  ['a11y/no-obsolete-attribute', rule('[dropzone]'), rule('[hidden]')],
  ['a11y/no-obsolete-element', rule('blink'), rule('.em')],
  ['a11y/no-outline-none', '.a:focus {\n  outline: none;\n}\n', '.a:focus {\n  outline: var(--focus-ring);\n}\n'],
  [
    'a11y/no-spread-text',
    '.a {\n  text-align: start;\n  max-width: 120ch;\n}\n',
    '.a {\n  text-align: start;\n  max-inline-size: var(--measure);\n}\n',
  ],
  ['a11y/no-text-align-justify', on('text-align: justify'), on('text-align: start')],
  ['a11y/selector-pseudo-class-focus', rule('.a:hover'), rule('.a:hover,\n.a:focus')],
  ['harness/design-tokens', on('padding-inline: 1rem'), on('padding-inline: var(--gap)')],
];

/** Every plant, one or more per rule `.stylelintrc.json` turns on. */
const PLANTS: readonly Plant[] = [...FROM_BIOME, ...STRICTER, ...HELD];

export { PLANTS };
export type { Plant };
