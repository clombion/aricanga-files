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
      // The `/testing` subpath must precede the bare specifier — first match wins.
      '@narratives/foundation/testing': src('packages/foundation/src/testing/index.ts'),
      '@narratives/foundation': src('packages/foundation/src/index.ts'),
      '@narratives/system-chat': src('packages/systems/chat/src/index.ts'),
      '@narratives/system-cards': src('packages/systems/cards/src/index.ts'),
    },
  },
});
