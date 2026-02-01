// Aricanga Experience - Explicit system composition
// This file shows how to compose systems for the Aricanga game experience

import {
  conversationSystem,
  createSystemContext,
  eventBus,
  Foundation,
  timeContext,
} from '@narratives/framework';

/**
 * Initialize the Aricanga game experience
 *
 * This function demonstrates explicit system composition:
 * 1. Create foundation
 * 2. Create context using factory
 * 3. Gather tag handlers and external functions from systems
 * 4. Start foundation with merged handlers
 * 5. Initialize systems in explicit order
 *
 * @param {string} storyUrl - URL to compiled ink JSON
 * @param {Object} [options]
 * @param {Object} [options.savedState] - Previously saved state to restore
 * @param {Object} [options.batteryConfig] - Battery configuration
 * @param {function(): Object} [options.getViewState] - Returns current view state
 * @param {function(): Object} [options.getI18n] - Returns i18n service
 * @returns {Promise<{foundation: Foundation, runtime: InkRuntime}>}
 */
export async function initAricanga(storyUrl, options = {}) {
  const foundation = new Foundation();

  // Factory handles boilerplate
  const context = createSystemContext({
    foundation,
    eventBus,
    timeContext,
    getViewState: options.getViewState,
    getI18n: options.getI18n,
  });

  // Explicit system composition
  const systems = [conversationSystem];
  const tagHandlers = systems.flatMap((s) => s.tagHandlers);
  const externalFunctions = systems.flatMap((s) =>
    s.createExternalFunctions(context),
  );

  // Start foundation with merged handlers
  await foundation.start(storyUrl, {
    tagHandlers,
    externalFunctions,
    savedState: options.savedState,
    getViewState: context.getViewState,
  });

  // Initialize systems in explicit order
  for (const system of systems) {
    system.init(foundation.runtime, eventBus, options);
  }

  return {
    foundation,
    runtime: foundation.runtime,
  };
}

export default initAricanga;
