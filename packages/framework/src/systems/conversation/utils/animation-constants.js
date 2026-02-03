/**
 * animation-constants.js - Shared animation easing curves
 *
 * Material 3 and custom easing values used across components.
 */

/** Material 3 Emphasized */
export const EMPHASIZED_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

/** Smooth deceleration for entrances */
export const DECELERATE_EASING = 'cubic-bezier(0.05, 0.7, 0.1, 1.0)';

/** Quick exit for dismissals */
export const EXIT_EASING = 'cubic-bezier(0.3, 0, 0.8, 0.15)';

/* ── Durations (ms) ─────────────────────────────────── */

/** Reduced-motion fallback, quick feedback */
export const DURATION_QUICK = 200;

/** Standard UI transitions */
export const DURATION_FAST = 300;

/** Drawer / overlay entrances */
export const DURATION_MEDIUM = 450;

/** Deliberate, noticeable animations */
export const DURATION_SLOW = 600;

/** Complex multi-part animations */
export const DURATION_ELABORATE = 900;

/** Simulated generation / loading */
export const DURATION_GENERATE = 1200;

/* ── Stagger intervals ──────────────────────────────── */

export const STAGGER_TIGHT = 30;
export const STAGGER_NORMAL = 50;
