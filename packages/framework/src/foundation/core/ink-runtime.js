// Ink Runtime - Wrapper around inkjs with layer-provided tag handlers
// Part of vocabulary-agnostic foundation layer

/**
 * InkRuntime wraps the inkjs Story object and provides:
 * - Tag parsing via provided TagHandlers
 * - External function binding
 * - Clean API for story operations
 *
 * This is vocabulary-agnostic - layers define the meaning of tags.
 */
export class InkRuntime extends EventTarget {
  /**
   * @param {Object} story - inkjs Story instance
   * @param {Object} [options]
   * @param {function(): Object} [options.getViewState] - Returns current view state
   * @param {Array<{tag: string, handler: function}>} [options.tagHandlers] - Tag handlers
   * @param {Array<{name: string, fn: function, lookAheadSafe?: boolean}>} [options.externalFunctions] - External functions
   */
  constructor(story, options = {}) {
    super();
    this.story = story;
    this._getViewState = options.getViewState || (() => ({}));
    this._pendingDataRequest = null;
    this._dataRequestId = 0;

    // Tag handlers map for fast lookup
    this._tagHandlers = new Map();
    if (options.tagHandlers) {
      for (const handler of options.tagHandlers) {
        this._tagHandlers.set(handler.tag, handler);
      }
    }

    // Store external functions for binding
    this._externalFunctions = options.externalFunctions || [];

    // Captured state during Continue() - read by state machine
    this._capturedDelay = 0;
    this._awaitingData = false;

    this._bindExternalFunctions();
  }

  // ============================================================================
  // Story Operations
  // ============================================================================

  /**
   * Check if story can continue
   * @returns {boolean}
   */
  get canContinue() {
    return this.story?.canContinue ?? false;
  }

  /**
   * Get current choices
   * @returns {Array}
   */
  get currentChoices() {
    return this.story?.currentChoices ?? [];
  }

  /**
   * Get current tags
   * @returns {string[]}
   */
  get currentTags() {
    return this.story?.currentTags ?? [];
  }

  /**
   * Get current knot name from story path
   * Extracts the first component of the path (before any dots)
   * @returns {string|null}
   */
  getCurrentKnot() {
    const path = this.story?.state?.currentPathString;
    if (!path) return null;
    return path.split('.')[0];
  }

  /**
   * Continue story and get next text
   * @returns {string}
   */
  Continue() {
    return this.story?.Continue() ?? '';
  }

  /**
   * Choose a choice by index
   * @param {number} index
   */
  ChooseChoiceIndex(index) {
    this.story?.ChooseChoiceIndex(index);
  }

  /**
   * Navigate to a path
   * @param {string} path
   */
  ChoosePathString(path) {
    this.story?.ChoosePathString(path);
  }

  // ============================================================================
  // Variable Access (Type-Safe)
  // ============================================================================

  /**
   * Get variable value
   * @param {string} name
   * @returns {*}
   */
  getVariable(name) {
    return this.story?.variablesState?.[name];
  }

  /**
   * Set variable value
   * @param {string} name
   * @param {*} value
   */
  setVariable(name, value) {
    if (this.story?.variablesState) {
      this.story.variablesState[name] = value;
    }
  }

  /**
   * Get variable as string with validation
   * @param {string} name
   * @param {string} [defaultValue='']
   * @returns {string}
   */
  getVariableString(name, defaultValue = '') {
    const val = this.getVariable(name);
    if (val === undefined || val === null) return defaultValue;
    if (typeof val !== 'string') {
      console.warn(
        `Ink var "${name}" expected string, got ${typeof val}:`,
        val,
      );
      return String(val);
    }
    return val;
  }

  /**
   * Get variable as number with validation
   * @param {string} name
   * @param {number} [defaultValue=0]
   * @returns {number}
   */
  getVariableNumber(name, defaultValue = 0) {
    const val = this.getVariable(name);
    if (val === undefined || val === null) return defaultValue;
    const num = Number(val);
    if (Number.isNaN(num)) {
      console.warn(`Ink var "${name}" is not a number:`, val);
      return defaultValue;
    }
    return num;
  }

  /**
   * Get variable as boolean with validation
   * @param {string} name
   * @param {boolean} [defaultValue=false]
   * @returns {boolean}
   */
  getVariableBoolean(name, defaultValue = false) {
    const val = this.getVariable(name);
    if (val === undefined || val === null) return defaultValue;
    if (typeof val === 'boolean') return val;
    if (val === 1 || val === 'true') return true;
    if (val === 0 || val === 'false') return false;
    console.warn(`Ink var "${name}" expected boolean, got:`, val);
    return Boolean(val);
  }

  /**
   * Observe a variable for changes
   * @param {string} name
   * @param {function(string, *): void} callback
   */
  observeVariable(name, callback) {
    try {
      this.story?.ObserveVariable(name, callback);
    } catch (_e) {
      // Variable might not exist
    }
  }

  // ============================================================================
  // State Serialization
  // ============================================================================

  /**
   * Save ink state to JSON
   * @returns {string}
   */
  saveState() {
    return this.story?.state?.ToJson() ?? '{}';
  }

  /**
   * Load ink state from JSON
   * @param {string} json
   */
  loadState(json) {
    try {
      this.story?.state?.LoadJson(json);
    } catch (e) {
      console.warn('Failed to load ink state:', e);
    }
  }

  // ============================================================================
  // Tag Parsing (Plugin-Aware)
  // ============================================================================

  /**
   * Parse ink tags using provided TagHandlers
   * Falls back to generic key:value parsing for unregistered tags
   * @param {string[]} tags - Raw tag strings from ink
   * @returns {Object} Parsed tag object
   */
  parseTags(tags) {
    const result = {};
    if (!tags) return result;

    for (const tag of tags) {
      const colonIdx = tag.indexOf(':');

      if (colonIdx === -1) {
        // Flag tag: "clear" -> { clear: true }
        const key = tag.trim();
        const handler = this._tagHandlers.get(key);
        if (handler) {
          const parsed = handler.handler(true, result);
          Object.assign(result, parsed);
        } else {
          result[key] = true;
        }
        continue;
      }

      const key = tag.slice(0, colonIdx).trim();
      const value = tag.slice(colonIdx + 1).trim();

      // Check for provided handler
      const handler = this._tagHandlers.get(key);
      if (handler) {
        const parsed = handler.handler(value, result);
        Object.assign(result, parsed);
      } else {
        // Generic key:value
        result[key] = value;
      }
    }

    return result;
  }

  // ============================================================================
  // External Functions (Plugin-Aware)
  // ============================================================================

  /**
   * Bind all provided external functions to the story
   * @private
   */
  _bindExternalFunctions() {
    if (!this.story) return;

    for (const extFn of this._externalFunctions) {
      try {
        this.story.BindExternalFunction(
          extFn.name,
          extFn.fn,
          extFn.lookAheadSafe ?? false,
        );
      } catch (e) {
        console.warn(`Failed to bind external function "${extFn.name}":`, e);
      }
    }
  }

  /**
   * Bind a single external function (for runtime additions)
   * @param {string} name
   * @param {function} fn
   * @param {boolean} [lookAheadSafe=false]
   */
  bindExternalFunction(name, fn, lookAheadSafe = false) {
    try {
      this.story?.BindExternalFunction(name, fn, lookAheadSafe);
    } catch (e) {
      console.warn(`Failed to bind external function "${name}":`, e);
    }
  }

  // ============================================================================
  // Captured State (for state machine coordination)
  // ============================================================================

  /**
   * Extract captured delay from story processing
   * Clears captured value after extraction
   * @returns {{delay: number}}
   */
  extractCapturedState() {
    const delay = this._capturedDelay || 0;
    this._capturedDelay = 0;
    return { delay };
  }

  /**
   * Set captured delay (called by external functions)
   * @param {number} ms
   */
  setCapturedDelay(ms) {
    this._capturedDelay = ms;
  }

  /**
   * Check if awaiting async data
   * @returns {boolean}
   */
  get awaitingData() {
    return this._awaitingData;
  }

  /**
   * Set awaiting data state
   * @param {boolean} value
   */
  set awaitingData(value) {
    this._awaitingData = value;
  }
}
