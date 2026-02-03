/**
 * Touch Gesture Handler
 *
 * Detects swipe gestures and dispatches navigation events.
 * Experience-specific thresholds tuned for phone-like interaction.
 */

/**
 * @typedef {Object} GestureConfig
 * @property {HTMLElement} appElement - Root element for touch listeners
 * @property {HTMLElement} contentArea - Content area for swipe-down detection
 * @property {Object} thresholds - Gesture thresholds
 * @property {number} thresholds.swipeRight - Minimum X delta for back navigation (default: 60)
 * @property {number} thresholds.swipeDown - Minimum Y delta for drawer open (default: 40)
 * @property {number} thresholds.swipeUp - Minimum Y delta for drawer close (default: 50)
 */

/**
 * @typedef {Object} GestureCallbacks
 * @property {Function} onSwipeRight - Called for back navigation gesture
 * @property {Function} onSwipeDown - Called for drawer open gesture
 * @property {Function} onSwipeUp - Called for drawer close gesture
 * @property {Function} isDrawerOpen - Returns true if notification drawer is open
 */

/**
 * Initialize gesture handling on the app element.
 *
 * @param {GestureConfig} config
 * @param {GestureCallbacks} callbacks
 * @returns {Function} Cleanup function to remove listeners
 */
export function initGestures(config, callbacks) {
  const { appElement, contentArea, thresholds = {} } = config;

  const { onSwipeRight, onSwipeDown, onSwipeUp, isDrawerOpen } = callbacks;

  const SWIPE_RIGHT_THRESHOLD = thresholds.swipeRight ?? 60;
  const SWIPE_DOWN_THRESHOLD = thresholds.swipeDown ?? 40;
  const SWIPE_UP_THRESHOLD = thresholds.swipeUp ?? 50;

  let touchStartX = null;
  let touchStartY = null;

  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchEnd(e) {
    if (touchStartX === null || touchStartY === null) return;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartX;
    const deltaY = endY - touchStartY;
    const absDX = Math.abs(deltaX);
    const absDY = Math.abs(deltaY);

    touchStartX = null;
    touchStartY = null;

    // Swipe-up anywhere: close notification drawer
    if (isDrawerOpen() && deltaY < -SWIPE_UP_THRESHOLD && absDY > absDX) {
      onSwipeUp();
      return;
    }

    // Swipe-down from top half: open notification drawer
    const contentRect = contentArea.getBoundingClientRect();
    const contentMidY = contentRect.top + contentRect.height / 2;
    const startY = endY - deltaY;
    if (
      !isDrawerOpen() &&
      deltaY > SWIPE_DOWN_THRESHOLD &&
      absDY > absDX &&
      startY < contentMidY
    ) {
      onSwipeDown();
      return;
    }

    // Swipe-right from left half: back navigation
    const appRect = appElement.getBoundingClientRect();
    const appMidX = appRect.left + appRect.width / 2;
    const startX = endX - deltaX;
    if (
      deltaX > SWIPE_RIGHT_THRESHOLD &&
      absDX > absDY &&
      startX < appMidX &&
      !isDrawerOpen()
    ) {
      onSwipeRight();
    }
  }

  appElement.addEventListener('touchstart', handleTouchStart, {
    passive: true,
  });
  appElement.addEventListener('touchend', handleTouchEnd, { passive: true });

  return function cleanup() {
    appElement.removeEventListener('touchstart', handleTouchStart);
    appElement.removeEventListener('touchend', handleTouchEnd);
  };
}
