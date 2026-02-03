# Vendored Dependencies

This directory contains local copies of third-party dependencies, eliminating CDN dependencies for offline use and reproducibility.

## XState v5.25.0

**Source:** node_modules/xstate/
**License:** MIT
**Homepage:** https://github.com/statelyai/xstate

### Why Vendored

- Removes esm.sh CDN dependency for browser ES modules
- Enables offline development
- Guarantees version consistency

### Structure

```
xstate/
  dist/           # Main ESM bundle (xstate.esm.js)
  actors/dist/    # Actor utilities
  guards/dist/    # Guard utilities
  dev/dist/       # Dev tools
```

### Updating

To update XState:

1. Update version in package.json
2. Run `npm install`
3. Copy the ESM distribution:
   ```bash
   rm -rf src/vendor/xstate
   mkdir -p src/vendor/xstate
   cp -r node_modules/xstate/dist src/vendor/xstate/
   cp -r node_modules/xstate/actors src/vendor/xstate/
   cp -r node_modules/xstate/guards src/vendor/xstate/
   cp -r node_modules/xstate/dev src/vendor/xstate/
   ```

### Usage

Source files import from the vendor path:

```javascript
import { createMachine, assign, createActor, fromPromise } from '../../vendor/xstate/dist/xstate.esm.js';
```

Vitest aliases the vendor path to the npm package for testing.

## ink.js (removed)

ink.js was previously vendored as a UMD bundle. It is now imported as an ESM module
from the `inkjs` npm package via `foundation/runtime/inkjs.js`.
