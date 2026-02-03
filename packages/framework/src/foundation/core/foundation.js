// Foundation - Main orchestrator for vocabulary-agnostic interactive fiction
// Manages story loading and runtime setup

import { Story } from '../runtime/inkjs.js';
import { InkRuntime } from './ink-runtime.js';

/**
 * Foundation is the main entry point for the interactive fiction engine.
 * It orchestrates:
 * - Ink story loading and runtime setup
 * - Service registration
 *
 * Foundation is vocabulary-agnostic. Layers provide tag handlers and external
 * functions through explicit composition in experience files.
 *
 * Usage:
 * ```js
 * import { Foundation } from './foundation/core/foundation.js';
 * import { conversationSystem } from './systems/conversation/index.js';
 *
 * const foundation = new Foundation();
 * await foundation.start('/story.json', {
 *   tagHandlers: conversationSystem.tagHandlers,
 *   externalFunctions: conversationSystem.externalFunctions,
 * });
 * conversationSystem.init(foundation.runtime);
 * ```
 */
export class Foundation extends EventTarget {
  constructor() {
    super();

    /** @type {InkRuntime|null} */
    this.runtime = null;

    /** @type {Object} */
    this._services = {};

    /** @type {boolean} */
    this._started = false;
  }

  // ============================================================================
  // Service Registration
  // ============================================================================

  /**
   * Register a service with the foundation
   * Services are singletons accessible throughout the app
   * @param {string} name - Service name
   * @param {Object} service - Service instance
   * @returns {Foundation} this for chaining
   */
  registerService(name, service) {
    if (this._services[name]) {
      console.warn(`Service "${name}" already registered, overwriting`);
    }
    this._services[name] = service;
    return this;
  }

  /**
   * Get a registered service
   * @param {string} name
   * @returns {Object|undefined}
   */
  getService(name) {
    return this._services[name];
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Start the foundation with a story
   * @param {string} storyUrl - URL to compiled ink JSON
   * @param {Object} [options]
   * @param {Array<{tag: string, handler: function}>} [options.tagHandlers] - Tag handlers from layers
   * @param {Array<{name: string, fn: function, lookAheadSafe?: boolean}>} [options.externalFunctions] - External functions from layers
   * @param {Object} [options.savedState] - Previously saved state to restore
   * @param {function(): Object} [options.getViewState] - Returns current view state
   * @returns {Promise<void>}
   */
  async start(storyUrl, options = {}) {
    if (this._started) {
      throw new Error('Foundation already started');
    }

    try {
      // 1. Load and compile story
      const res = await fetch(storyUrl);
      const json = await res.json();

      const story = new Story(json);

      // 2. Create InkRuntime with provided handlers
      this.runtime = new InkRuntime(story, {
        getViewState: options.getViewState || (() => ({})),
        tagHandlers: options.tagHandlers || [],
        externalFunctions: options.externalFunctions || [],
      });

      // 3. Restore saved state if provided
      if (options.savedState?.inkState) {
        this.runtime.loadState(options.savedState.inkState);
      }

      this._started = true;

      // 4. Dispatch ready event
      this.dispatchEvent(
        new CustomEvent('ready', { detail: { runtime: this.runtime } }),
      );
    } catch (error) {
      console.error('Foundation start failed:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
      throw error;
    }
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  /**
   * Get the ink runtime
   * @returns {InkRuntime|null}
   */
  getRuntime() {
    return this.runtime;
  }

  /**
   * Get the underlying inkjs story
   * @returns {Object|null}
   */
  getStory() {
    return this.runtime?.story ?? null;
  }

  /**
   * Check if foundation has started
   * @returns {boolean}
   */
  get started() {
    return this._started;
  }
}

// Export singleton-friendly factory
export function createFoundation() {
  return new Foundation();
}

/**
 * Create a SystemContext object for use with system external functions.
 * Reduces boilerplate when setting up system composition.
 *
 * @param {Object} options
 * @param {Foundation} options.foundation - The foundation instance
 * @param {EventBus} options.eventBus - Event bus for cross-component communication
 * @param {TimeContext} options.timeContext - Time context service
 * @param {function(): Object} [options.getViewState] - Returns current view state
 * @param {function(): Object|null} [options.getI18n] - Returns i18n service
 * @returns {import('../types.js').SystemContext}
 */
export function createSystemContext({
  foundation,
  eventBus,
  timeContext,
  getViewState = () => ({}),
  getI18n = () => null,
}) {
  return {
    getRuntime: () => foundation.runtime,
    getViewState,
    getTimeContext: () => timeContext,
    getI18n,
    getEventBus: () => eventBus,
  };
}
