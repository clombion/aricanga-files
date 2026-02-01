// Foundation Types - JSDoc typedefs for the system architecture
// These provide type hints for IDE autocompletion and documentation

/**
 * Context object passed to system external functions.
 * Provides access to runtime services without tight coupling.
 *
 * @typedef {Object} SystemContext
 * @property {function(): InkRuntime} getRuntime - Returns the ink runtime instance
 * @property {function(): Object} getViewState - Returns current view state (e.g., { type: 'chat', chatId: 'pat' })
 * @property {function(): TimeContext} getTimeContext - Returns the time context service
 * @property {function(): Object|null} getI18n - Returns the i18n service or null if not configured
 * @property {function(): EventBus} getEventBus - Returns the event bus instance
 */

/**
 * Tag handler definition for processing ink tags.
 *
 * @typedef {Object} TagHandler
 * @property {string} tag - The tag name to handle (e.g., 'speaker', 'delay')
 * @property {function(string, Object): Object} handler - Handler function that receives the tag value and current context, returns object to merge into context
 */

/**
 * External function definition for ink.
 *
 * @typedef {Object} ExternalFunction
 * @property {string} name - Function name as called from ink (e.g., 'delay_next')
 * @property {function(...any): any} fn - The JavaScript function implementation
 * @property {boolean} lookAheadSafe - If true, safe to call during ink's lookahead evaluation (no side effects)
 */

/**
 * System interface.
 * Systems define vocabulary for specific types of interactive fiction.
 *
 * @typedef {Object} System
 * @property {string} id - Unique identifier for the system (e.g., 'conversation', 'adventure')
 * @property {TagHandler[]} tagHandlers - Array of tag handlers this system provides
 * @property {function(SystemContext): ExternalFunction[]} createExternalFunctions - Factory that creates external functions with access to context
 * @property {function(InkRuntime, EventBus, Object=): void} init - Initialize the system after foundation starts
 */

// Export empty object to make this a module (types are available via JSDoc)
export {};
