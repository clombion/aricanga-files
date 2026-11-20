import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Map vendor imports to npm packages for unit tests
      [resolve(__dirname, 'packages/framework/src/vendor/xstate/dist/xstate.esm.js')]: 'xstate',
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: [
      'packages/tests/**/*.test.ts',
      'experiences/*/tests/**/*.test.ts',
    ],
  },
});
