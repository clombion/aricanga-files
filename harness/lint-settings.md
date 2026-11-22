# CSS and JSON rules

Biome is not one of this repository's tools. stylelint lints CSS, the `json-files` check holds JSON,
and oxfmt formats every held TypeScript, CSS and JSON file. This page maps each Biome rule that
could apply to our CSS and JSON to the tool that holds it, and gives each stylelint rule's setting
with its reason. Each stylelint rule turned on is held by a plant in
`harness/checks/stylesheets.plants.ts`, which the `stylesheets` check requires one of per rule.

## Biome's CSS and JSON rules, and where each is held

Biome 2.6.8 ran its recommended preset over held `.css` and `.json` files. Its nursery rules were
not in force under that preset: a nursery plant (an unsafe number, a non-normalised key) drew no
finding. The "Biome fired" column is Biome's own verdict on the plant of the rule that holds the
case, run under that preset; "no" means the plant is outside what Biome's rule refuses.

| Biome rule | In force | Held by | Biome fired |
| --- | --- | --- | --- |
| `useGenericFontNames` | yes | stylelint `font-family-no-missing-generic-family-keyword` | no |
| `noImportantStyles` | yes | stylelint `declaration-no-important` | no |
| `noInvalidDirectionInLinearGradient` | yes | stylelint `function-linear-gradient-no-nonstandard-direction` | yes |
| `noInvalidGridAreas` | yes | stylelint `named-grid-areas-no-invalid` | yes |
| `noInvalidPositionAtImportRule` | yes | stylelint `no-invalid-position-at-import-rule` | yes |
| `noMissingVarFunction` | yes | stylelint `custom-property-no-missing-var-function` | yes |
| `noUnknownFunction` | yes | stylelint `function-no-unknown` | yes |
| `noUnknownMediaFeatureName` | yes | stylelint `media-feature-name-no-unknown` | yes |
| `noUnknownProperty` | yes | stylelint `property-no-unknown` | yes |
| `noUnknownPseudoClass` | yes | stylelint `selector-pseudo-class-no-unknown` | yes |
| `noUnknownPseudoElement` | yes | stylelint `selector-pseudo-element-no-unknown` | yes |
| `noUnknownTypeSelector` | yes | stylelint `selector-type-no-unknown`; `selector-max-type: 0` refuses every type selector | no |
| `noUnknownUnit` | yes | stylelint `unit-no-unknown`, `unit-allowed-list` | yes |
| `noUnmatchableAnbSelector` | yes | stylelint `selector-anb-no-unmatchable` | yes |
| `noDescendingSpecificity` | yes | stylelint `no-descending-specificity` | no |
| `noDeprecatedMediaType` | yes | stylelint `media-type-no-deprecated` | no |
| `noDuplicateAtImportRules` | yes | stylelint `no-duplicate-at-import-rules` | yes |
| `noDuplicateCustomProperties` | yes | stylelint `declaration-block-no-duplicate-custom-properties` | yes |
| `noDuplicateFontNames` | yes | stylelint `font-family-no-duplicate-names` | yes |
| `noDuplicateProperties` | yes | stylelint `declaration-block-no-duplicate-properties` | yes |
| `noDuplicateSelectorsKeyframeBlock` | yes | stylelint `keyframe-block-no-duplicate-selectors` | yes |
| `noEmptyBlock` | yes | stylelint `block-no-empty` | no |
| `noImportantInKeyframe` | yes | stylelint `keyframe-declaration-no-important` | yes |
| `noShorthandPropertyOverrides` | yes | stylelint `declaration-block-no-shorthand-property-overrides` | yes |
| `noUnknownAtRules` | yes | stylelint `at-rule-no-unknown` | yes |
| `noZeroLengthUnit` | no | stylelint `length-zero-no-unit` | no |
| `noInvalidPropertyInitValue` | no | dropped: no stylelint rule checks an `@property` `initial-value` against its `syntax`, and no held sheet declares an `@property`; `at-rule-property-required-list` requires the three descriptors | no |
| Biome's CSS parser | yes | stylelint's parser, and `selector-no-invalid` for a selector the parser admits | yes |
| `noDuplicateObjectKeys` (JSON) | yes | `json-files`: a key written twice at any depth | yes |
| Biome's JSON parser (a trailing comma, a comment, a missing quote) | yes | `json-files`: strict RFC 8259 JSON, tsconfig files included | yes |
| `noJsonUnsafeValues` | no | `json-files`: a number outside JavaScript's range, rounding to zero or past the safe integers; a lone surrogate | no |
| `useConsistentObjectKeys` | no | `json-files`: a key not in Unicode normal form C | no |
| `noEmptyObjectKeys` (not recommended) | no | `json-files`: an empty key | no |
| `noDuplicateDependencies` (not recommended) | no | `json-files`: a package in two conflicting dependency groups, or twice in a bundled list (twice in one group is a duplicate key) | no |
| `usePackageJsonValidEngines` | no | the `node-floor` check, which reads `engines.node` as a semver range | no |
| `usePackageJsonValidLicense` | no | dropped: no held manifest has a `license` field; the packages are private | no |
| `usePackageJsonValidCpu` | no | dropped: no held manifest has a `cpu` field | no |
| `noBiomeFirstException`, `useBiomeIgnoreFolder`, `noQuickfixBiome` | yes | dropped: each reads only Biome's own configuration or editor settings | no |
| Biome's CSS and JSON formatter | yes | oxfmt, at the print width of 140 the TypeScript uses | yes |

Biome's other recommended rules whose documentation shows a JSON example (`noDoubleEquals`,
`noUnusedVariables`, `useImportType` and the like) are JavaScript and TypeScript rules whose
options are written in JSON; oxlint holds those, and Biome ran over no `.ts` file here.

## stylelint rules turned on in `.stylelintrc.json`, past the standard config

| Rule | Setting | Reason |
| --- | --- | --- |
| `selector-max-type` | `0` | Parts are styled by class; an element selector couples a style to markup. |
| `selector-max-universal` | `0` | A universal selector styles what no class names. |
| `selector-max-id` | `0` | An id is unique per page and a shadow root's ids are its own. |
| `selector-max-attribute` | `1` | One state attribute (`[hidden]`, `[aria-expanded]`) is legitimate; two is a selector doing a class's work. |
| `selector-max-class` | `3` | Three compound selectors under `selector-max-specificity: 0,2,0` need one `:where()`, whose class counts. |
| `selector-max-pseudo-class` | `3` | `:where()` counts as one; two states beside it. |
| `selector-max-combinators` | `2` | Matches `selector-max-compound-selectors: 3`. |
| `selector-combinator-allowed-list` | `" "`, `">"` | Sibling combinators reach across a component's own markup. |
| `selector-max-specificity` | `0,2,0` | No selector outranks a two-class rule, so the cascade follows source order. |
| `selector-max-compound-selectors` | `3` | Deep selectors couple a style to markup depth. |
| `max-nesting-depth` | `1` | Nesting past one level hides the selector a rule really writes. |
| `relative-selector-nesting-notation` | `explicit` | A nested selector starts with `&`, so it reads as the selector it is. |
| `selector-no-qualifying-type` | on | A type-qualified class is a type selector. |
| `selector-no-deprecated`, `selector-no-invalid`, `selector-no-unmatchable` | on | A selector that is deprecated, invalid or matches nothing is a defect. |
| `no-descending-specificity` | on | The held sheets are ordered so a later rule never loses to an earlier, more specific one; it finds 0 sites. |
| `declaration-no-important` | on | `!important` overrides the specificity cap. |
| `color-named` | `never` | Colours are tokens. |
| `color-no-hex` | on | A token colour is written `rgb()`/`oklch()`, a notation `color-function-notation` holds; a hex colour outside tokens is refused by `declaration-strict-value` too. |
| `color-no-invalid-hex` | on | A malformed hex colour is a defect wherever it is written. |
| `font-weight-notation` | `numeric` | One notation. |
| `declaration-property-unit-allowed-list` | per property | Type in `rem`, borders and outlines in `px`, durations in `ms`, sizes in relative units. |
| `unit-allowed-list` | `rem em % ch px ms deg fr` and the viewport-logical units | No other unit has a use here; `vw`/`vh` are physical and refused by logical-css too. |
| `time-min-milliseconds` | `100` | A shorter duration or delay is no perceptible motion. |
| `media-feature-name-unit-allowed-list` | width and height in `rem`/`em` | Breakpoints follow the user's text size. |
| `function-url-no-scheme-relative`, `function-url-scheme-allowed-list` | on, `data` | The experiences run under `default-src 'self'`; a remote URL is refused by the policy. |
| `no-unknown-animations`, `no-unknown-custom-media` | on | A name with no definition in the sheet is a defect. |
| `at-rule-property-required-list` | `@property` needs `syntax`, `inherits`, `initial-value` | A registration missing one is not registered. |
| `comment-word-disallowed-list` | `TODO`, `FIXME`, `XXX` | Open work lives in an issue. |
| `display-notation` | `short` | One notation for `display`. |
| `scale-unlimited/declaration-strict-value` | colours, fill, stroke, z-index, durations, curves, and the shorthands holding them; `ignoreFunctions: false` | Raw values only in `tokens.css`; a raw colour written as a function (`rgb(255 255 255)`) is refused like a hex one. |
| logical-css, no-unsupported-browser-features, a11y, `harness/design-tokens` | on | The logical-property, browser-support, accessibility and token rules. |
| `order/order` | custom properties, declarations, nested rules, then at-rules; anything else last | One shape per block: a reader finds a block's own values before what it nests. |
| `order/properties-alphabetical-order` | on | One declaration order with no list to keep: a property is found where the alphabet puts it, and a duplicate sits beside its twin. A grouped order would be a hand-kept list that drifts as properties are added. |

## stylelint rules left off, each with its reason

| Rule | Reason |
| --- | --- |
| `no-unknown-custom-properties` | It reads one sheet at a time, and tokens are defined in `tokens.css`; the `stylesheets` check's cross-sheet scan holds that every custom property read is defined. |
| `at-rule-allowed-list`, `at-rule-disallowed-list`, `function-allowed-list`, `function-disallowed-list`, `property-allowed-list`, `property-disallowed-list`, `unit-disallowed-list`, `selector-disallowed-list`, `selector-pseudo-class-allowed-list`, `selector-pseudo-class-disallowed-list`, `selector-pseudo-element-allowed-list`, `selector-pseudo-element-disallowed-list`, `selector-attribute-name-disallowed-list`, `selector-attribute-operator-allowed-list`, `selector-attribute-operator-disallowed-list`, `selector-combinator-disallowed-list`, `declaration-property-value-allowed-list`, `declaration-property-value-disallowed-list`, `media-feature-name-allowed-list`, `media-feature-name-disallowed-list`, `media-feature-name-value-allowed-list`, `rule-selector-property-disallowed-list`, `rule-nesting-at-rule-required-list`, `function-url-scheme-disallowed-list` | Each needs a project list, and the lists in force (units, combinators, URL schemes, token-held properties) already say what is allowed; a second list per category would restate them. |
| `property-layout-mappings`, `unit-layout-mappings`, `value-keyword-layout-mappings` | `stylelint-plugin-logical-css` holds logical properties, keywords and units; one owner per rule. |
| `declaration-property-max-values` | No property has a value count the other rules leave open. |
| `selector-nested-pattern`, `comment-pattern` | No naming convention for nested selectors or comments beyond `relative-selector-nesting-notation` and `comment-word-disallowed-list`. |
| `color-hex-alpha` | `color-no-hex` refuses every hex colour. |

## Plugins that would add strictness

Not installed (a new dependency needs the owner's approval):

- `stylelint-use-logical-spec`: overlaps `stylelint-plugin-logical-css`; no gain.
