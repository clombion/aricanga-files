import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: [
      'packages/tests/**/*.test.ts',
      'experiences/*/tests/**/*.test.ts',
    ],
    globals: true,
  },
  resolve: {
    alias: {
      // Map vendor imports to npm packages for unit tests
      [resolve(__dirname, 'packages/framework/src/vendor/xstate/dist/xstate.esm.js')]: 'xstate',
    },
  },
});
