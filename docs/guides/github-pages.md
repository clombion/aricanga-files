# Deploying to GitHub Pages

## Prerequisites

- Node.js and pnpm installed
- `mise` installed (see `mise.toml`)
- A GitHub repository with Pages enabled

## Build for Production

All deployment methods start with the same build step:

```bash
IMPL=aricanga mise run build:prod
```

This runs the full pipeline (config generation, ink compilation, seed extraction, image optimization) then produces a static site in `experiences/aricanga/dist/`.

To verify the build locally before deploying:

```bash
IMPL=aricanga mise run preview
# Opens at http://localhost:4173
```

## Option 1: Manual Deployment

Use the `gh-pages` package to push `dist/` contents to a `gh-pages` branch:

```bash
pnpm exec gh-pages -d experiences/aricanga/dist
```

Then in GitHub: **Settings → Pages → Source → Deploy from a branch → `gh-pages` / `/ (root)`**.

The site will be available at `https://<username>.github.io/<repo>/`.

## Option 2: GitHub Actions (CI)

This approach deploys automatically on every push to `main` using the modern Pages API (no `gh-pages` branch needed).

### 1. Enable Pages

**Settings → Pages → Source → GitHub Actions**

### 2. Create the workflow

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - uses: jdx/mise-action@v2
      - run: pnpm install --frozen-lockfile
      - run: IMPL=aricanga mise run build:prod
      - uses: actions/upload-pages-artifact@v3
        with:
          path: experiences/aricanga/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 3. Push and verify

Push to `main`. The Actions tab will show the deployment run. Once complete, the URL appears in the workflow output and under **Settings → Pages**.

## Notes

- **Subpath hosting**: `vite.config.js` sets `base: './'`, so the site works under any subpath without changes.
- **inklecate**: Vendored in the repo — no extra CI installation needed.
- **Multiple locales**: Both `en` and `fr` story files are compiled and bundled. The app handles locale selection at runtime.
- **Runtime assets**: Files loaded at runtime via `fetch` (story JSON, locale JSON, TOML data, CSS, fonts, images) live in `experiences/aricanga/public/`. Vite copies `public/` to `dist/` automatically — no manual `cp` commands needed. If you add new runtime-loaded assets, place them in `public/` with the correct directory structure.
- **Chunk splitting**: `vite.config.js` uses `manualChunks` to isolate `packages/framework/src/foundation/` into a separate chunk. This prevents a circular dependency deadlock between the entry chunk (which uses top-level `await`) and the component chunk (which imports shared registries). Do not remove this without verifying the production build still initializes.
