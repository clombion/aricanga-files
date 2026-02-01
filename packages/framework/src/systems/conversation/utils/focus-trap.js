/**
 * focus-trap.js - Reusable focus trap utility for modals
 *
 * Traps keyboard focus within a container element (e.g., lightbox, drawer).
 * Stores previous activeElement on activate and restores on deactivate.
 */

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Create a focus trap for a container element
 * @param {ShadowRoot|Element} container - Container to trap focus within
 * @returns {{ activate: () => void, deactivate: () => void }}
 */
export function createFocusTrap(container) {
  let previousActiveElement = null;
  let keydownHandler = null;

  function getFocusableElements() {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)).filter(
      (el) => el.offsetParent !== null,
    );
  }

  function handleKeydown(e) {
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Determine the active element (could be in shadow DOM)
    const active = container.activeElement || document.activeElement;

    if (e.shiftKey) {
      // Shift+Tab: if at first element, wrap to last
      if (active === first || !focusable.includes(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if at last element, wrap to first
      if (active === last || !focusable.includes(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return {
    activate() {
      // Store current focus
      previousActiveElement = document.activeElement;

      // Add keydown handler
      keydownHandler = handleKeydown;
      container.addEventListener('keydown', keydownHandler);
    },

    deactivate() {
      // Remove keydown handler
      if (keydownHandler) {
        container.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
      }

      // Restore previous focus
      if (
        previousActiveElement &&
        typeof previousActiveElement.focus === 'function'
      ) {
        previousActiveElement.focus();
      }
      previousActiveElement = null;
    },
  };
}
