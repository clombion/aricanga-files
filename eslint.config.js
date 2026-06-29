// Module boundary lint for the rebuild stack (task-005).
// Enforces the layered dependency direction:
//   foundation → (nothing)   systems → foundation   experiences → foundation + systems
// and forbids one system importing another. The POC is not linted.
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      'node_modules/**',
      'packages/framework/**',
      'packages/tests/**',
      'packages/test-utils/**',
      'experiences/aricanga/**',
      'utils/**',
      'templates/**',
      'docs/**',
    ],
  },
  {
    files: ['packages/**/*.ts', 'experiences/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'foundation', mode: 'folder', pattern: 'packages/foundation' },
        { type: 'system', mode: 'folder', pattern: 'packages/systems/*', capture: ['name'] },
        { type: 'experience', mode: 'folder', pattern: 'experiences/*', capture: ['name'] },
      ],
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            'packages/foundation/tsconfig.json',
            'packages/systems/*/tsconfig.json',
            'experiences/*/tsconfig.json',
          ],
        },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: { type: 'foundation' }, disallow: { to: { type: '*' } } },
            { from: { type: 'system' }, allow: { to: { type: 'foundation' } } },
            { from: { type: 'experience' }, allow: { to: { type: ['foundation', 'system'] } } },
          ],
        },
      ],
    },
  },
  {
    // Reducer-purity guard (ADR-0007, testing-strategy.md): the kernel reads time
    // and ids only from `ReduceContext`/the input — never the wall clock or random.
    // Scoped to the chat reducer surface (`system.ts` today, `model/**` later); does
    // NOT touch `view`, which legitimately reads `RenderContext.locale`.
    files: ['packages/systems/chat/src/system.ts', 'packages/systems/chat/src/model/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: 'No Date.now in a reducer — time is simulation-derived (ADR-0007).',
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'No Math.random in a reducer — ids come from ctx.nextId (ADR-0007).',
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'No new Date in a reducer — time is simulation-derived (ADR-0007).',
        },
      ],
    },
  },
];
