/**
 * Navigation Manager
 *
 * Manages view stack and animated transitions for phone-like navigation.
 * Provides push/pop/replace semantics that eliminate manual "wasInX" tracking.
 *
 * Key behaviors:
 * - Queue serializes transitions (prevents concurrent animation corruption)
 * - Stack tracks navigation history (eliminates boolean state tracking)
 * - Motion level configurable (full/reduced/off)
 * - onReady/onComplete callbacks for deferred operations
 *
 * IMPORTANT: Lock screen is OUTSIDE the navigation stack
 * ---------------------------------------------------
 * The lock screen is a separate overlay layer, not part of hub→thread→overlay flow.
 * Lock screen transitions must use transitionViews() directly, not NavigationManager.
 *
 * Why: NavigationManager tracks a stack of views. If you call init(hub) then
 * replace(hub, ...) on unlock, outgoing===incoming and animation is skipped.
 * Lock screen ↔ hub transitions are conceptually different from in-app navigation.
 *
 * Pattern in main.js:
 *   // Lock screen unlock - use transitionViews directly
 *   transitionViews(lockScreen, hub, { direction: 'slide-up', ... });
 *
 *   // In-app navigation - use NavigationManager
 *   navigation.push(thread);
 *   navigation.pop();
 */

import {
  MOTION_LEVELS,
  TRANSITIONS,
  transitionViews,
} from './utils/view-transitions.js';

/**
 * @typedef {Object} NavigationOptions
 * @property {'page'|'overlay'} [type='page'] - Page uses slide, overlay uses fade with scrim
 * @property {'slide-left'|'slide-right'|'slide-up'|'slide-down'} [direction] - Explicit direction override
 * @property {Function} [onReady] - Called after positioning, before animation (may be async)
 * @property {Function} [onComplete] - Called after animation and cleanup
 * @property {*} [data] - Arbitrary data to associate with this view
 */

/**
 * @typedef {Object} StackEntry
 * @property {HTMLElement} element - The view element
 * @property {'page'|'overlay'} type - Navigation type
 * @property {*} [data] - Associated data
 */

/**
 * Creates a NavigationManager instance.
 *
 * @param {Object} config
 * @param {Function} config.getMotionLevel - Returns current motion preference ('full'|'reduced'|'off')
 * @param {HTMLElement} [config.overlayElement] - Scrim element for overlay transitions
 * @returns {NavigationManager}
 */
export function createNavigationManager(config = {}) {
  const { getMotionLevel = () => MOTION_LEVELS.FULL, overlayElement = null } =
    config;

  /** @type {StackEntry[]} */
  let stack = [];

  /** @type {Promise<void>} */
  let transitionQueue = Promise.resolve();

  /** @type {HTMLElement|null} */
  let overlayEl = overlayElement;

  /** @type {Function} */
  let motionLevelGetter = getMotionLevel;

  /**
   * Queue a transition to prevent concurrent animations.
   * @param {Function} fn - Async function to execute
   * @returns {Promise<void>}
   */
  function enqueue(fn) {
    const run = async () => {
      try {
        await fn();
      } catch (err) {
        console.error('[NavigationManager] Transition error:', err);
      }
    };
    transitionQueue = transitionQueue.then(run, run);
    return transitionQueue;
  }

  /**
   * Push a new view onto the stack.
   *
   * @param {HTMLElement} incoming - View to navigate to
   * @param {NavigationOptions} [options={}]
   * @returns {Promise<void>}
   */
  function push(incoming, options = {}) {
    const { type = 'page', direction, onReady, onComplete, data } = options;

    return enqueue(async () => {
      const outgoing =
        stack.length > 0 ? stack[stack.length - 1].element : null;

      // Determine transition config
      const isOverlay = type === 'overlay';
      const transitionConfig = isOverlay
        ? TRANSITIONS.OPEN_OVERLAY
        : TRANSITIONS.ENTER_DEEPER;
      const finalDirection = direction || transitionConfig.direction;

      // Add to stack before transition
      stack.push({ element: incoming, type, data });

      if (outgoing) {
        await transitionViews(outgoing, incoming, {
          ...transitionConfig,
          direction: finalDirection,
          motionLevel: motionLevelGetter(),
          overlay: isOverlay ? overlayEl : undefined,
          onReady,
          onComplete,
        });
      } else {
        // No outgoing view - just show incoming
        incoming.hidden = false;
        if (onReady) await onReady();
        if (onComplete) onComplete();
      }
    });
  }

  /**
   * Pop the current view from the stack.
   *
   * @param {NavigationOptions} [options={}]
   * @returns {Promise<void>}
   */
  function pop(options = {}) {
    const { direction, onReady, onComplete } = options;

    return enqueue(async () => {
      if (stack.length < 2) {
        console.warn('[NavigationManager] Cannot pop: stack too shallow');
        return;
      }

      const outgoingEntry = stack.pop();
      const incomingEntry = stack[stack.length - 1];

      const isOverlay = outgoingEntry.type === 'overlay';
      const transitionConfig = isOverlay
        ? TRANSITIONS.CLOSE_OVERLAY
        : TRANSITIONS.GO_BACK;
      const finalDirection = direction || transitionConfig.direction;

      await transitionViews(outgoingEntry.element, incomingEntry.element, {
        ...transitionConfig,
        direction: finalDirection,
        motionLevel: motionLevelGetter(),
        overlay: isOverlay ? overlayEl : undefined,
        onReady,
        onComplete,
      });
    });
  }

  /**
   * Replace the current view without growing the stack.
   *
   * @param {HTMLElement} incoming - View to replace with
   * @param {NavigationOptions} [options={}]
   * @returns {Promise<void>}
   */
  function replace(incoming, options = {}) {
    const { type = 'page', direction, onReady, onComplete, data } = options;

    return enqueue(async () => {
      const outgoingEntry = stack.length > 0 ? stack[stack.length - 1] : null;
      const outgoing = outgoingEntry?.element;

      // Replace in stack
      if (stack.length > 0) {
        stack[stack.length - 1] = { element: incoming, type, data };
      } else {
        stack.push({ element: incoming, type, data });
      }

      if (outgoing && outgoing !== incoming) {
        await transitionViews(outgoing, incoming, {
          direction: direction || TRANSITIONS.ENTER_DEEPER.direction,
          duration: 300,
          motionLevel: motionLevelGetter(),
          onReady,
          onComplete,
        });
      } else {
        incoming.hidden = false;
        if (onReady) await onReady();
        if (onComplete) onComplete();
      }
    });
  }

  /**
   * Check if back navigation is possible.
   * @returns {boolean}
   */
  function canGoBack() {
    return stack.length > 1;
  }

  /**
   * Get the current view element.
   * @returns {HTMLElement|null}
   */
  function current() {
    return stack.length > 0 ? stack[stack.length - 1].element : null;
  }

  /**
   * Get the previous view element.
   * @returns {HTMLElement|null}
   */
  function previous() {
    return stack.length > 1 ? stack[stack.length - 2].element : null;
  }

  /**
   * Get the current stack depth.
   * @returns {number}
   */
  function depth() {
    return stack.length;
  }

  /**
   * Configure motion level getter.
   * @param {Function} getter - Returns 'full'|'reduced'|'off'
   */
  function setMotionLevel(getter) {
    motionLevelGetter = getter;
  }

  /**
   * Configure the overlay element for scrim effects.
   * @param {HTMLElement} el
   */
  function setOverlayElement(el) {
    overlayEl = el;
  }

  /**
   * Reset the navigation stack (for testing or game reset).
   * @param {HTMLElement} [root] - Optional root view to set as base
   */
  function reset(root) {
    stack = root ? [{ element: root, type: 'page' }] : [];
  }

  /**
   * Initialize with a root view.
   * @param {HTMLElement} root - The base view element
   */
  function init(root) {
    stack = [{ element: root, type: 'page' }];
  }

  return {
    push,
    pop,
    replace,
    canGoBack,
    current,
    previous,
    depth,
    setMotionLevel,
    setOverlayElement,
    reset,
    init,
  };
}

/**
 * @typedef {ReturnType<typeof createNavigationManager>} NavigationManager
 */
