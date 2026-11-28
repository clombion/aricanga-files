/** The rule levels of the gate's oxlint configuration: every rule a category turns on stays at error unless it is set here. */

import { HARNESS_LIB } from './test-globs.ts';
import type { OxlintConfig } from 'oxlint';
import { TYPESCRIPT } from './source-files.ts';

/** The rules whose options name members: `oxlint-config.ts` sets each over the population, and `RULES` cannot set one (its type refuses the key), so the two maps compose with no key in both. */
type MemberRule =
  | 'aricanga/flags'
  | 'aricanga/legacy'
  | 'aricanga/mechanics'
  | 'aricanga/mirrors'
  | 'aricanga/store-owner'
  | 'aricanga/sync-parts'
  | 'aricanga/vm-prop';

/** Each rule set beside its category: off where it contradicts another enabled rule, or with its options; never a `MemberRule`. */
const RULES: NonNullable<OxlintConfig['rules']> & Readonly<Partial<Record<MemberRule, never>>> = {
  'aricanga/autofocus': 'error',
  'aricanga/controlled': 'error',
  'aricanga/env': [
    'error',
    {
      owners: [`${HARNESS_LIB}process.ts`, `${HARNESS_LIB}tools.ts`],
    },
  ],
  'aricanga/json': 'error',
  'aricanga/labels': 'error',
  'aricanga/own-keys': 'error',
  'aricanga/specifier': 'error',
  'aricanga/statics': 'error',
  'aricanga/style-prop': 'error',
  'aricanga/test-expect': 'error',
  'aricanga/total-reads': 'error',
  'aricanga/view-imports': 'error',
  'eslint/capitalized-comments': [
    'error',
    'always',
    {
      ignoreConsecutiveComments: true,
      ignorePattern: 'pragma|ignore|oxlint|eslint|c8|v8|istanbul|@ts|[a-z][a-z0-9-]*[(/:.@-]',
    },
  ],
  'eslint/eqeqeq': 'error',
  'eslint/func-style': [
    'error',
    'declaration',
    {
      allowArrowFunctions: true,
    },
  ],
  'eslint/new-cap': [
    'error',
    {
      capIsNewExceptions: ['BindExternalFunction', 'ChooseChoiceIndex', 'Compile', 'Continue', 'LoadJson', 'ToJson'],
    },
  ],
  'eslint/no-console': 'error',
  'eslint/no-duplicate-imports': [
    'error',
    {
      allowSeparateTypeImports: true,
    },
  ],
  'eslint/no-ternary': 'off',
  'eslint/no-undefined': 'off',
  'eslint/one-var': ['error', 'never'],
  'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
  'import/no-cycle': 'error',
  'import/no-named-export': 'off',
  'import/prefer-default-export': 'off',
  'jsx-a11y/label-has-associated-control': 'off',
  'node/no-top-level-await': 'off',
  'oxc/no-async-await': 'off',
  'oxc/no-optional-chaining': 'off',
  'oxc/no-rest-spread-properties': 'off',
  'solid/components-return-once': 'error',
  'solid/event-handlers': 'error',
  'solid/imports': 'error',
  'solid/jsx-no-duplicate-props': 'error',
  'solid/jsx-no-script-url': 'error',
  'solid/jsx-no-undef': 'error',
  'solid/jsx-uses-vars': 'error',
  'solid/no-accessor-as-prop': 'error',
  'solid/no-array-handlers': 'off',
  'solid/no-boolean-enumerated-attribute': 'error',
  'solid/no-browser-globals-in-server-function': 'error',
  'solid/no-destructure': 'error',
  'solid/no-innerhtml': 'error',
  'solid/no-invalid-server-capture': 'error',
  'solid/no-module-scope-reactive-primitive': 'error',
  'solid/no-proxy-apis': 'off',
  'solid/no-react-deps': 'off',
  'solid/no-react-specific-props': 'error',
  'solid/no-restated-default-options': 'error',
  'solid/no-single-arg-create-effect': 'error',
  'solid/no-store-mutation-outside-setter': 'error',
  'solid/no-unassigned-vars': 'error',
  'solid/no-unknown-namespaces': 'error',
  'solid/no-unused-signal': 'error',
  'solid/no-write-in-pure-computation': 'error',
  'solid/prefer-classlist': 'off',
  'solid/prefer-for': 'error',
  'solid/prefer-onSettled-for-side-effects': 'error',
  'solid/prefer-show': 'off',
  'solid/prefer-structured-class': 'error',
  'solid/reactivity': 'error',
  'solid/removed-api': 'error',
  'solid/require-async-server-function': 'error',
  'solid/self-closing-comp': 'error',
  'solid/style-prop': 'error',
  'solid/valid-use-server': 'error',
  'solid/validate-jsx-nesting': 'error',
  'typescript/await-thenable': 'error',
  'typescript/ban-ts-comment': [
    'error',
    {
      minimumDescriptionLength: 10,
      'ts-check': false,
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': true,
      'ts-nocheck': true,
    },
  ],
  'typescript/consistent-type-imports': 'error',
  'typescript/dot-notation': [
    'error',
    {
      allowIndexSignaturePropertyAccess: true,
    },
  ],
  'typescript/no-explicit-any': 'error',
  'typescript/no-floating-promises': 'error',
  'typescript/no-misused-promises': 'error',
  'typescript/no-non-null-assertion': 'error',
  'typescript/no-unnecessary-type-assertion': 'error',
  'typescript/no-unsafe-argument': 'error',
  'typescript/no-unsafe-assignment': 'error',
  'typescript/no-unsafe-call': 'error',
  'typescript/no-unsafe-member-access': 'error',
  'typescript/no-unsafe-return': 'error',
  'typescript/prefer-readonly-parameter-types': [
    'error',
    {
      allow: [
        {
          from: 'package',
          name: [
            'Node',
            'SourceFile',
            'Symbol',
            'Type',
            'CommentRange',
            'Statement',
            'Expression',
            'TypeChecker',
            'Program',
            'Identifier',
            'Declaration',
            'ImportDeclaration',
            'TypeAliasDeclaration',
            'InterfaceDeclaration',
            'CallExpression',
            'ExportDeclaration',
            'VariableStatement',
            'FunctionDeclaration',
            'ClassDeclaration',
            'PropertyAccessExpression',
            'StringLiteral',
            'JsxAttribute',
            'Signature',
            'NodeHandle',
          ],
          package: 'typescript',
        },
        {
          from: 'package',
          name: [
            'Root',
            'Rule',
            'Declaration',
            'AtRule',
            'Node',
            'Container',
            'Result',
            'Root_',
            'Rule_',
            'Declaration_',
            'AtRule_',
            'Result_',
            'Container_',
          ],
          package: 'postcss',
        },
        {
          from: 'package',
          name: ['PostcssResult', 'RuleContext', 'Rule', 'RuleBase', 'Problem', 'PostcssResult'],
          package: 'stylelint',
        },
        {
          from: 'package',
          name: ['TestContext'],
          package: 'vitest',
        },
      ],
      treatMethodsAsReadonly: true,
    },
  ],
  'typescript/restrict-template-expressions': 'error',
  'typescript/switch-exhaustiveness-check': 'error',
  'typescript/triple-slash-reference': ['error', { lib: 'always', path: 'never', types: 'never' }],
  'vitest/consistent-test-filename': [
    'error',
    {
      pattern: String.raw`.*\.(test|spec)(?:${[...TYPESCRIPT].map((suffix) => suffix.replaceAll('.', String.raw`\.`)).join('|')})$`,
    },
  ],
  'vitest/consistent-test-it': [
    'error',
    {
      fn: 'test',
      withinDescribe: 'test',
    },
  ],
  'vitest/no-disabled-tests': 'error',
  'vitest/no-focused-tests': 'error',
  'vitest/no-hooks': 'off',
  'vitest/no-importing-vitest-globals': 'off',
  'vitest/prefer-to-be-falsy': 'off',
  'vitest/prefer-to-be-truthy': 'off',
  'vitest/require-test-timeout': 'off',
  'vitest/valid-expect': [
    'error',
    {
      maxArgs: 2,
    },
  ],
};

export { RULES };
export type { MemberRule };
