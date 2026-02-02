/**
 * View Transition Utilities
 *
 * Provides animated transitions between views using the Web Animation API.
 * Works with shadow DOM by animating custom element hosts directly.
 *
 * Uses Material 3 "Emphasized" motion for native Android feel:
 * - Parallax: outgoing moves 30%, incoming moves 100%
 * - Easing: cubic-bezier(0.2, 0, 0, 1) - snappy start, soft landing
 * - Scrim: darkens outgoing view to create depth
 * - Shadow: elevation on incoming view
 */

/**
 * Material 3 Emphasized easing curve
 * Snappy acceleration + long smooth deceleration
 */
const EMPHASIZED_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

/**
 * Race a promise against a timeout. Ensures cleanup code in `finally` blocks
 * executes even when Web Animation API `.finished` hangs in headless browsers.
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Animation timeout')), ms),
    ),
  ]);
}

/**
 * Parallax factor - how much the background moves relative to foreground
 * Native Android uses ~30% for depth effect
 */
const PARALLAX_FACTOR = 0.3;

/**
 * Scrim opacity - darkens background to create depth
 * Native Android uses ~32%
 */
const SCRIM_OPACITY = 0.32;

/**
 * Motion level constants for animation control
 */
export const MOTION_LEVELS = {
  FULL: 'full',
  REDUCED: 'reduced',
  OFF: 'off',
};

/**
 * Predefined transition configurations with Material 3 timings
 * Forward = 300ms (Signal-inspired snappy motion)
 * Back = 250ms (get out of the way)
 */
export const TRANSITIONS = {
  /** Lock screen unlock - reveals hub beneath */
  UNLOCK: { direction: 'slide-up', duration: 400 },
  /** Navigate deeper (hub → chat, chat → profile) */
  ENTER_DEEPER: { direction: 'slide-left', duration: 300 },
  /** Go back to previous view */
  GO_BACK: { direction: 'slide-right', duration: 250 },
  /** Open overlay page (settings, about, glossary) */
  OPEN_OVERLAY: { direction: 'slide-left', duration: 300 },
  /** Close overlay page */
  CLOSE_OVERLAY: { direction: 'slide-right', duration: 250 },
};

/**
 * Get transform values for parallax navigation
 * Incoming element travels 100%, outgoing travels only 30% (parallax)
 *
 * @param {'slide-left'|'slide-right'|'slide-up'|'slide-down'} direction
 * @returns {{ incomingStart: string, incomingEnd: string, outgoingStart: string, outgoingEnd: string, isForward: boolean }}
 */
function getTransforms(direction) {
  const parallax = `${PARALLAX_FACTOR * 100}%`;

  switch (direction) {
    case 'slide-left':
      // Forward: incoming slides over outgoing (incoming on top)
      return {
        incomingStart: 'translateX(100%)',
        incomingEnd: 'translateX(0)',
        outgoingStart: 'translateX(0)',
        outgoingEnd: `translateX(-${parallax})`,
        isForward: true,
      };
    case 'slide-right':
      // Back: outgoing slides away, revealing incoming beneath
      return {
        incomingStart: `translateX(-${parallax})`,
        incomingEnd: 'translateX(0)',
        outgoingStart: 'translateX(0)',
        outgoingEnd: 'translateX(100%)',
        isForward: false,
      };
    case 'slide-up':
      // Forward: incoming slides up over outgoing
      return {
        incomingStart: 'translateY(100%)',
        incomingEnd: 'translateY(0)',
        outgoingStart: 'translateY(0)',
        outgoingEnd: `translateY(-${parallax})`,
        isForward: true,
      };
    case 'slide-down':
      // Back: outgoing slides down, revealing incoming beneath
      return {
        incomingStart: `translateY(-${parallax})`,
        incomingEnd: 'translateY(0)',
        outgoingStart: 'translateY(0)',
        outgoingEnd: 'translateY(100%)',
        isForward: false,
      };
    default:
      return {
        incomingStart: 'translateX(100%)',
        incomingEnd: 'translateX(0)',
        outgoingStart: 'translateX(0)',
        outgoingEnd: `translateX(-${parallax})`,
        isForward: true,
      };
  }
}

/**
 * Simple crossfade transition for reduced motion preference.
 * Overlaps fadeOut and fadeIn to prevent black flash between views.
 *
 * @param {HTMLElement} outgoing
 * @param {HTMLElement} incoming
 * @param {number} duration
 * @param {HTMLElement} [overlay]
 * @returns {Promise<void>}
 */
async function transitionViewsFade(
  outgoing,
  incoming,
  duration,
  overlay,
  onReady,
  onComplete,
) {
  // Clear any state from previous full-motion transitions
  outgoing.style.transform = '';
  incoming.style.transform = '';
  outgoing.style.zIndex = '';
  incoming.style.zIndex = '';
  outgoing.style.boxShadow = '';
  incoming.style.boxShadow = '';

  // Layer incoming behind outgoing for crossfade
  outgoing.style.zIndex = '2';
  incoming.style.zIndex = '1';
  incoming.hidden = false;

  if (onReady) await onReady();

  const animationOptions = {
    duration: duration / 2,
    easing: 'ease-out',
    fill: 'both', // Apply first keyframe immediately, hold last keyframe
  };

  // Start both animations simultaneously for true crossfade
  const fadeOut = outgoing.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    animationOptions,
  );
  const fadeIn = incoming.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    animationOptions,
  );

  try {
    await withTimeout(
      Promise.all([fadeOut.finished, fadeIn.finished]),
      duration + 500,
    );
  } finally {
    // Always cancel animations first - even if Promise resolved,
    // cancelling a finished animation is a no-op
    fadeOut.cancel();
    fadeIn.cancel();

    outgoing.hidden = true;
    outgoing.style.opacity = '';
    outgoing.style.zIndex = '';
    outgoing.classList.remove('ink-transitioning');

    incoming.style.opacity = '';
    incoming.style.zIndex = '';
    incoming.classList.remove('ink-transitioning');

    if (overlay) {
      overlay.hidden = true;
      overlay.style.opacity = '';
    }

    if (onComplete) onComplete();
  }
}

/**
 * Transition between two views with native-feel animation
 *
 * Uses Material 3 Emphasized motion:
 * - Parallax depth (outgoing moves 30%, incoming moves 100%)
 * - Emphasized easing (snappy start, soft landing)
 * - Scrim overlay (darkens background for depth)
 * - Elevation shadow (on incoming element)
 *
 * @param {HTMLElement} outgoing - Element to hide (will have hidden added)
 * @param {HTMLElement} incoming - Element to show (will have hidden removed)
 * @param {Object} options - Transition options
 * @param {'slide-left'|'slide-right'|'slide-up'|'slide-down'} options.direction - Slide direction
 * @param {number} [options.duration] - Duration in ms (default: 500)
 * @param {HTMLElement} [options.overlay] - Optional overlay element for scrim effect
 * @param {'full'|'reduced'|'off'} [options.motionLevel] - Animation level (default: 'full')
 * @param {Function} [options.onReady] - Called after incoming is positioned offscreen but before
 *   animation starts. Use for rendering content (innerHTML, render()). May be async.
 * @param {Function} [options.onComplete] - Called after animation finishes and cleanup is done.
 *   Use for scrollIntoView, focus, or other layout-forcing operations.
 * @returns {Promise<void>} Resolves when animation completes
 */
export async function transitionViews(outgoing, incoming, options = {}) {
  const {
    direction = 'slide-left',
    duration = 500,
    overlay,
    motionLevel = MOTION_LEVELS.FULL,
    onReady,
    onComplete,
  } = options;

  // Null check - gracefully handle missing elements
  if (!outgoing || !incoming) {
    if (outgoing) outgoing.hidden = true;
    if (incoming) incoming.hidden = false;
    return;
  }

  // Instant transition if motion is off
  if (motionLevel === MOTION_LEVELS.OFF) {
    if (onReady) await onReady();
    outgoing.hidden = true;
    incoming.hidden = false;
    if (onComplete) onComplete();
    return;
  }

  // Shared setup for animated paths: position both elements absolutely
  // so they overlap instead of stacking in overflow:hidden containers
  outgoing.classList.add('ink-transitioning');
  incoming.classList.add('ink-transitioning');

  // Fade transition for reduced motion
  if (motionLevel === MOTION_LEVELS.REDUCED) {
    return transitionViewsFade(
      outgoing,
      incoming,
      duration,
      overlay,
      onReady,
      onComplete,
    );
  }

  const transforms = getTransforms(direction);
  const isHorizontal =
    direction === 'slide-left' || direction === 'slide-right';

  // Clear stale inline styles from previous transitions (e.g. commitStyles residue)
  // before setting up new animation. Prevents flash if browser paints stale transform.
  incoming.style.transform = '';
  incoming.style.zIndex = '';
  incoming.style.boxShadow = '';
  outgoing.style.transform = '';
  outgoing.style.zIndex = '';
  outgoing.style.boxShadow = '';

  // Set z-index for proper layering
  // Forward: incoming on top (slides over)
  // Back: outgoing on top (slides away)
  if (transforms.isForward) {
    outgoing.style.zIndex = '1';
    incoming.style.zIndex = '2';
    // Elevation shadow on incoming (slides over outgoing)
    incoming.style.boxShadow = isHorizontal
      ? '-5px 0 15px rgba(0, 0, 0, 0.15)'
      : '0 -5px 15px rgba(0, 0, 0, 0.15)';
  } else {
    outgoing.style.zIndex = '2';
    incoming.style.zIndex = '1';
    // Elevation shadow on outgoing (slides away from incoming)
    outgoing.style.boxShadow = isHorizontal
      ? '-5px 0 15px rgba(0, 0, 0, 0.15)'
      : '0 -5px 15px rgba(0, 0, 0, 0.15)';
  }

  // Position incoming at start position before revealing
  incoming.style.transform = transforms.incomingStart;
  incoming.hidden = false;

  // Let caller prepare content while incoming is positioned offscreen
  if (onReady) await onReady();

  // Position outgoing for animation
  outgoing.style.transform = transforms.outgoingStart;

  // Animation with Material 3 Emphasized easing
  const animationOptions = {
    duration,
    easing: EMPHASIZED_EASING,
    fill: 'forwards',
  };

  const animations = [
    outgoing.animate(
      [
        { transform: transforms.outgoingStart },
        { transform: transforms.outgoingEnd },
      ],
      animationOptions,
    ),
    incoming.animate(
      [
        { transform: transforms.incomingStart },
        { transform: transforms.incomingEnd },
      ],
      animationOptions,
    ),
  ];

  // Scrim animation if overlay provided
  // Forward: fade in (0 → 0.32)
  // Back: fade out (0.32 → 0)
  if (overlay) {
    overlay.hidden = false;
    if (transforms.isForward) {
      overlay.style.opacity = '0';
      animations.push(
        overlay.animate(
          [{ opacity: 0 }, { opacity: SCRIM_OPACITY }],
          animationOptions,
        ),
      );
    } else {
      overlay.style.opacity = String(SCRIM_OPACITY);
      animations.push(
        overlay.animate(
          [{ opacity: SCRIM_OPACITY }, { opacity: 0 }],
          animationOptions,
        ),
      );
    }
  }

  // Wait for all animations with guaranteed cleanup
  try {
    await withTimeout(
      Promise.all(animations.map((a) => a.finished)),
      duration + 500,
    );

    // Commit animation final state to inline styles
    // This removes the fill: 'forwards' effect while keeping the visual state
    for (const a of animations) {
      // Guard: element may have been removed or hidden during animation.
      // commitStyles throws if target is not rendered (e.g. hidden attribute).
      try {
        if (a.effect?.target?.isConnected) {
          a.commitStyles();
        }
      } catch {
        // Target not rendered — safe to ignore since finally clears all inline styles
      }
    }
  } finally {
    // Always cancel animations first - critical for error path where
    // animations would otherwise keep running and control element styles
    for (const a of animations) {
      a.cancel();
    }

    // Clean up styles and state
    outgoing.hidden = true;
    outgoing.classList.remove('ink-transitioning');
    outgoing.style.transform = '';
    outgoing.style.zIndex = '';
    outgoing.style.boxShadow = '';

    incoming.classList.remove('ink-transitioning');
    incoming.style.transform = '';
    incoming.style.zIndex = '';
    incoming.style.boxShadow = '';

    if (overlay) {
      overlay.hidden = true;
      overlay.style.opacity = '';
    }

    if (onComplete) onComplete();
  }
}
