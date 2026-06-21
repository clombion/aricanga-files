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
];
