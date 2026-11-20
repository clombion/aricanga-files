import type { Host } from '#src/host/effects';

/**
 * The ports a deterministic test host shares: a scheduler whose timers fire only when the test fires
 * them, and a save store that keeps one save in memory.
 */

/**
 * A scheduler that hands each timer to `hold` and never fires or cancels one itself: the test
 * decides when, and whether, a timer fires.
 *
 * @param {Function} hold - Where each scheduled timer's callback goes.
 * @returns {Host['scheduler']} The scheduler.
 */
function heldScheduler(hold: (fire: () => void) => void): Host['scheduler'] {
  return {
    schedule: (_delayMs, fire) => {
      hold(fire);
      return () => {
        // A held timer is never cancelled: the test owns whether it fires.
      };
    },
  };
}

/**
 * A save store that keeps the last save in memory.
 *
 * @returns {Host['store']} The store.
 */
function memoryStore(): Host['store'] {
  const saved: { text: string | undefined } = { text: undefined };
  return {
    load: () => saved.text,
    save: (data) => {
      saved.text = data;
    },
  };
}

export { heldScheduler, memoryStore };
