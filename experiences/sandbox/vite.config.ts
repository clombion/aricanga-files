import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/full';
import { type Plugin, defineConfig } from 'vite';

const fromHere = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Compile story.ink → public/story.json as part of the build (task-007 AC #1).
// Runs on both `vite dev` and `vite build` via buildStart.
function compileInk(): Plugin {
  return {
    name: 'compile-ink',
    buildStart() {
      const out = fromHere('public/story.json');
      const json = new Compiler(readFileSync(fromHere('story.ink'), 'utf8'))
        .Compile()
        .ToJson();
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, json ?? '');
    },
  };
}

export default defineConfig({
  plugins: [compileInk()],
  resolve: {
    alias: {
      '@narratives/foundation': fromHere('../../packages/foundation/src/index.ts'),
      '@narratives/system-chat': fromHere('../../packages/systems/chat/src/index.ts'),
    },
  },
  build: { outDir: 'build', emptyOutDir: true },
});
