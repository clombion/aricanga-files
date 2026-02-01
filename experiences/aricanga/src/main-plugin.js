// Main Entry Point (Composable Systems Architecture)
// Demonstrates explicit system composition for the phone game
//
// This file shows how to bootstrap the game using the system architecture.
// Currently runs alongside the original main.js architecture.
// Once migration is complete, this can replace main.js.

import { initAricanga } from './aricanga-experience.js';

/**
 * Initialize the game using the system architecture
 *
 * Usage:
 * ```html
 * <script type="module" src="src/experiences/aricanga/main-plugin.js"></script>
 * ```
 *
 * Or programmatically:
 * ```js
 * import { initGame } from './main-plugin.js';
 * const { foundation, runtime } = await initGame('/story.json');
 * ```
 */
export async function initGame(storyUrl, options = {}) {
  try {
    const result = await initAricanga(storyUrl, options);
    console.log('[main-plugin] Game initialized with system architecture');
    return result;
  } catch (error) {
    console.error('[main-plugin] Failed to initialize:', error);
    throw error;
  }
}

// ============================================================================
// Composable Systems Architecture Documentation
// ============================================================================

/**
 * The composable systems architecture separates concerns:
 *
 * 1. FOUNDATION (vocabulary-agnostic)
 *    - InkRuntime: Wraps inkjs, accepts tag handlers as params
 *    - EventBus: Cross-component communication
 *    - TimeContext: Day/time simulation
 *    - StorageAdapter: Persistence abstraction
 *
 * 2. SYSTEMS (vocabulary-specific, self-contained)
 *    - conversationSystem: Phone-style messaging UI
 *      - tagHandlers: Static array of tag handlers
 *      - createExternalFunctions(context): Factory for external functions
 *      - init(runtime, eventBus): Explicit initialization
 *
 *    - Future systems follow same shape:
 *      { id, tagHandlers, createExternalFunctions(), init() }
 *
 * 3. IMPLEMENTATIONS (explicit composition)
 *    - aricanga-experience.js: Composes systems for Aricanga game
 *    - Explicit import order, no dynamic lookup
 *    - Clear dependency flow
 *
 * 4. APPLICATION (game-specific)
 *    - main.js: Wires implementation + DOM
 *    - Config: TOML files for game data
 *    - Ink: Story content
 *
 * Benefits:
 * - No registry indirection
 * - Explicit composition in implementation files
 * - Systems are simple objects with known shape
 * - Easy to understand, test, and debug
 */

export default initGame;
