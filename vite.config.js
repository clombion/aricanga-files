import { defineConfig } from 'vite'

export default defineConfig({
  // Root is set per-implementation via CLI: --root experiences/aricanga
  base: './',  // Allows deployment to subpaths (itch.io, GitHub Pages subfolders)
  server: {
    port: 8000,
    fs: {
      allow: ['..']  // Allow access to packages/ outside implementation root
    }
  },
  build: {
    outDir: 'dist',  // Relative to --root
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Foundation modules must live in a shared chunk so the component chunk
        // never imports back into the entry chunk. Without this, top-level await
        // in the entry creates a circular-dependency deadlock in production builds.
        manualChunks(id) {
          if (id.includes('packages/framework/src/foundation/')) {
            return 'foundation';
          }
        }
      }
    }
  }
})
