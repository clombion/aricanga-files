import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Resolve workspace packages to their TypeScript source so dev and build compile
// from source (no prebuilt dist needed). Aliases live in this one place (task-002 AC #3).
const fromSrc = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@narratives/foundation': fromSrc('../../packages/foundation/src/index.ts'),
      '@narratives/system-chat': fromSrc('../../packages/systems/chat/src/index.ts'),
    },
  },
  // Vite output kept separate from tsc's dist/ to avoid clobbering it.
  build: { outDir: 'build', emptyOutDir: true },
});
