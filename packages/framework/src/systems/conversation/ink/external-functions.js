/**
 * External Functions - Shared ink function definitions
 *
 * These functions are used by both:
 * 1. Runtime InkBridge (browser) - for live story playback
 * 2. Build-time seed extraction (Node.js) - for pre-computing backstory
 *
 * Keeping them in one place ensures consistency between build and runtime.
 *
 * @module external-functions
 */

/**
 * @typedef {Object} ExternalFunctionConfig
 * @property {function(string, string=): string} getName - Localized name lookup
 * @property {function(string): string} getData - External data lookup
 * @property {function(): void} [advanceDay] - Advance simulation day
 * @property {function(number): void} [setDelay] - Capture delay for next message
 * @property {function(string): void} [playSound] - Trigger sound effect
 * @property {function(string, string, string): void} [requestData] - Async data request
 */

/**
 * Create external function bindings for ink stories
 *
 * @param {Object} config - Configuration for external functions
 * @param {function(string, string=): string} config.getName - Returns localized name
 * @param {function(string): *} [config.getData] - Returns external data value
 * @param {function(): void} [config.advanceDay] - Advance simulation day
 * @param {function(number): void} [config.captureDelay] - Capture delay for next message
 * @param {function(string): void} [config.playSound] - Trigger sound effect
 * @param {function(string, string, string): void} [config.requestData] - Async data request
 * @returns {Object} Map of function name -> function for story.BindExternalFunction()
 */
export function createExternalFunctions(config) {
  const {
    getName,
    getData = () => '',
    advanceDay,
    captureDelay,
    playSound,
    requestData,
  } = config;

  return {
    /**
     * name(key, variant) - Returns localized name
     *
     * Usage in ink:
     *   {name("activist", "first_name")} → "Maria"
     *   {name("aricanga", "short")} → "Aricanga"
     *   {name("ministry", "reference")} → "The Ministry"
     *
     * @param {string} key - Entity or character ID
     * @param {string} [variant='short'] - Name variant to retrieve
     * @returns {string} Localized name or key if not found
     */
    name: (key, variant = 'short') => {
      return getName(key, variant);
    },

    /**
     * data(key) - Returns external data value
     *
     * Usage in ink:
     *   {data("median_revenue")} → "$42M"
     *
     * @param {string} key - Data key to look up
     * @returns {*} Data value or empty string
     */
    data: (key) => {
      return getData(key);
    },

    /**
     * delay_next(ms) - Set delay before next message
     *
     * Usage in ink:
     *   ~ delay_next(1500)
     *   Hello! // This message appears after 1.5s delay
     *
     * @param {number} ms - Delay in milliseconds
     */
    delay_next: captureDelay || (() => {}),

    /**
     * play_sound(soundId) - Trigger a sound effect
     *
     * Usage in ink:
     *   ~ play_sound("notification")
     *
     * @param {string} soundId - Sound identifier
     */
    play_sound: playSound || (() => {}),

    /**
     * advance_day() - Move simulation to next day
     *
     * Usage in ink:
     *   ~ advance_day()
     *
     */
    advance_day: advanceDay || (() => {}),

    /**
     * request_data(source, query, params) - Request external data async
     *
     * Usage in ink:
     *   ~ request_data("eiti", "beneficial_owners", "aricanga")
     *
     * @param {string} source - Data source identifier
     * @param {string} query - Query type
     * @param {string} params - Query parameters
     */
    request_data: requestData || (() => {}),
  };
}

/**
 * Bind external functions to an ink story instance
 *
 * @param {Object} story - inkjs Story instance
 * @param {Object} functions - Function map from createExternalFunctions()
 */
export function bindExternalFunctions(story, functions) {
  for (const [name, fn] of Object.entries(functions)) {
    try {
      story.BindExternalFunction(name, fn);
    } catch (_e) {
      // Function might not be declared in ink, skip it
    }
  }
}

/**
 * Create a minimal set of external functions for build-time seed extraction.
 *
 * In build context, we don't need:
 * - play_sound (no audio)
 * - request_data (async not supported)
 * - advance_day (no time simulation)
 *
 * We only need:
 * - name() for text interpolation
 * - data() for data interpolation
 * - delay_next() to capture delays (stored on story object)
 *
 * @param {Object} config
 * @param {function(string, string=): string} config.getName - Name lookup function
 * @param {function(string): *} [config.getData] - Data lookup function
 * @param {Object} config.story - Story instance to capture delay on
 * @returns {Object} Function map for bindExternalFunctions()
 */
export function createBuildExternalFunctions(config) {
  const { getName, getData = () => '', story } = config;

  return {
    name: (key, variant = 'short') => getName(key, variant),
    data: (key) => getData(key),
    delay_next: (ms) => {
      // Capture delay on story object for seed extraction
      if (story) {
        story._capturedDelay = ms;
      }
    },
    // No-op for build context
    play_sound: () => {},
    advance_day: () => {},
    request_data: () => {},
  };
}
