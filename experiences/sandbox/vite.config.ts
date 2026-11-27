import type { Connect, Plugin, UserConfigFnPromise } from 'vite';
import { Compiler } from 'inkjs/full';
import type { ServerResponse } from 'node:http';
import { defineConfig } from 'vite';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import solid from '@solidjs/vite-plugin';

/** What the middleware writes the story through. */
type StoryResponse = Readonly<Pick<ServerResponse, 'end' | 'setHeader'>>;

/** What the plugin registers its middleware on. */
type Server = Readonly<{ middlewares: Readonly<Pick<Connect.Server, 'use'>> }>;

/**
 * A path beside this config.
 * @param {string} file The path, relative to this file.
 * @returns {string} The absolute path.
 */
function fromHere(file: string): string {
  return path.join(import.meta.dirname, file);
}

/**
 * `story.ink` compiled to the JSON the runtime loads.
 * @returns {Promise<string>} The story JSON.
 */
async function compiledStory(): Promise<string> {
  const source = await readFile(fromHere('story.ink'), 'utf8');
  return new Compiler(source).Compile().ToJson() ?? '';
}

/**
 * Serve `/story.json` from memory in dev and emit it into the bundle on build, so neither writes into
 * the checkout. The story is compiled when the config loads: an edit to story.ink takes a restart.
 * @param {string} story The compiled story.
 * @returns {Plugin} The plugin.
 */
function compileInk(story: string): Plugin {
  return {
    configureServer(server: Server) {
      server.middlewares.use('/story.json', (_request: unknown, response: StoryResponse) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(story);
      });
    },
    generateBundle() {
      this.emitFile({ fileName: 'story.json', source: story, type: 'asset' });
    },
    name: 'compile-ink',
  };
}

const config: UserConfigFnPromise = defineConfig(async () => ({
  build: { emptyOutDir: true, outDir: 'build' },
  plugins: [compileInk(await compiledStory()), solid()],
  resolve: {
    alias: [
      { find: /^@narratives\/foundation$/u, replacement: fromHere('../../packages/foundation/src/index.ts') },
      { find: /^@narratives\/system-chat$/u, replacement: fromHere('../../packages/systems/chat/src/index.ts') },
    ],
  },
}));

export default config;
