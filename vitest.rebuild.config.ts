import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Rebuild test config (kept separate from the POC's vitest.config.ts).
// Headless unit tests + happy-dom component tests, run against workspace source.
const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: [
      'packages/foundation/**/*.test.ts',
      'packages/systems/**/*.test.ts',
      'experiences/sandbox/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@narratives/foundation': src('packages/foundation/src/index.ts'),
      '@narratives/system-chat': src('packages/systems/chat/src/index.ts'),
    },
  },
});
