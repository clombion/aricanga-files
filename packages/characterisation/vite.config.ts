import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import solid from '@solidjs/vite-plugin';

// Dev-mode Solid build so the runtime's structured diagnostics ([CODE] message)
// print to the console — that console stream is what the characterisation specs
// assert against. `mode: 'development'` is forced regardless of how vite is
// invoked, so `vite build` + `vite preview` and `vite dev` both carry the dev
// runtime. The native @solidjs/compiler is used (no Babel).
const config: UserConfig = defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    target: 'es2022',
  },
  define: {
    // Belt-and-braces: ensure the dev runtime condition resolves even under build.
    'import.meta.env.DEV': 'true',
  },
  plugins: [solid({ dev: true })],
  preview: { port: 8100 },
  resolve: {
    conditions: ['development', 'browser'],
  },
  root: import.meta.dirname,
  server: { port: 8100 },
});

export default config;
