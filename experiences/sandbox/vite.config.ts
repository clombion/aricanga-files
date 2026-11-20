import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/full';
import { type Plugin, defineConfig } from 'vite';

const fromHere = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** story.ink compiled to the JSON the runtime loads. */
function compiledStory(): string {
  return new Compiler(readFileSync(fromHere('story.ink'), 'utf8')).Compile().ToJson() ?? '';
}

// Compile story.ink to /story.json: emitted into the bundle on build, served from memory in dev,
// so neither writes into the checkout.
function compileInk(): Plugin {
  return {
    name: 'compile-ink',
    configureServer(server) {
      server.middlewares.use('/story.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(compiledStory());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'story.json', source: compiledStory() });
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
