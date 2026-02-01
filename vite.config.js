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
    emptyOutDir: true
  }
})
