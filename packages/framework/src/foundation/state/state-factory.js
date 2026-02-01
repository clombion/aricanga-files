// State Machine Factory - Common patterns for XState machines
// Part of vocabulary-agnostic foundation layer

/**
 * State Factory provides common XState patterns and utilities
 * that plugins can use to build their state machines.
 *
 * This is a thin wrapper - plugins bring their own vocabulary
 * and state machine definitions.
 */

/**
 * Common guard patterns
 */
export const commonGuards = {
  /**
   * Check if story can continue
   * @param {Object} context - State machine context with story reference
   * @returns {boolean}
   */
  canContinue: ({ context }) => context.story?.canContinue ?? false,

  /**
   * Check if story has choices
   * @param {Object} context
   * @returns {boolean}
   */
  hasChoices: ({ context }) => (context.story?.currentChoices?.length ?? 0) > 0,

  /**
   * Check if awaiting async data
   * @param {Object} context
   * @returns {boolean}
   */
  isAwaitingData: ({ context }) => context.story?._awaitingData === true,
};

/**
 * Create a delay service actor for XState
 * @param {Object} options
 * @param {boolean} [options.respectReducedMotion=true] - Skip delays for prefers-reduced-motion
 * @returns {Object} XState actor config
 */
export function createDelayActor(options = {}) {
  const { respectReducedMotion = true } = options;

  return {
    src: 'delayService',
    implementation: ({ input }) => {
      const ms = input.pendingDelay ?? input.delay ?? 0;
      const prefersReduced =
        respectReducedMotion &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      return new Promise((resolve) => {
        setTimeout(resolve, prefersReduced ? 0 : ms);
      });
    },
  };
}

/**
 * Generate a unique message/entity ID
 * @returns {string}
 */
export function generateId() {
  return (
    window.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Extract captured state from ink runtime
 * Used to coordinate external function calls with state machine
 * @param {Object} story - inkjs Story instance
 * @returns {{delay: number}}
 */
export function extractCapturedState(story) {
  const delay = story._capturedDelay || 0;
  story._capturedDelay = 0;
  return { delay };
}

/**
 * Immutably append to a history map
 * @param {Object} history - Map of id -> array
 * @param {string} id - Key to append to
 * @param {Object} item - Item to append
 * @returns {Object} New history object
 */
export function appendToHistory(history, id, item) {
  const existing = history[id] || [];
  return {
    ...history,
    [id]: [...existing, item],
  };
}
