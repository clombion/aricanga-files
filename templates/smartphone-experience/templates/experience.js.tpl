// {{title}} Experience - System composition
// This file composes the systems needed for the smartphone chat experience

import {
  createSystemContext,
  Foundation,
  eventBus,
  timeContext,
  conversationSystem,
} from '@narratives/framework';

/**
 * Initialize the {{title}} experience
 *
 * This function composes the conversation system to create a
 * smartphone messaging experience.
 *
 * @param {string} storyUrl - URL to compiled ink JSON
 * @param {Object} [options]
 * @param {Object} [options.savedState] - Previously saved state to restore
 * @param {Object} [options.batteryConfig] - Battery configuration
 * @param {function(): Object} [options.getViewState] - Returns current view state
 * @param {function(): Object} [options.getI18n] - Returns i18n service
 * @returns {Promise<{foundation: Foundation, runtime: InkRuntime}>}
 */
export async function init{{namePascal}}(storyUrl, options = {}) {
  const foundation = new Foundation();

  // Create context using factory
  const context = createSystemContext({
    foundation,
    eventBus,
    timeContext,
    getViewState: options.getViewState,
    getI18n: options.getI18n,
  });

  // System composition - smartphone uses conversation system
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

  // Initialize systems
  for (const system of systems) {
    system.init(foundation.runtime, eventBus, options);
  }

  return {
    foundation,
    runtime: foundation.runtime,
  };
}

export default init{{namePascal}};
