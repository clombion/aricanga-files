/**
 * lock-screen-wake.js - Wake-up stagger animation for lock screen
 *
 * Runs the choreographed entrance sequence when the lock screen appears.
 * Extracted from lock-screen.js for modularity (TASK-136).
 */

import {
  DECELERATE_EASING,
  DURATION_QUICK,
} from '../utils/animation-constants.js';

// Wake animation choreography — staggered entrance sequence
const WAKE = {
  BG: { delay: 0, duration: 900 },
  STATUSBAR: { delay: 200, duration: 500 },
  DATE_WEATHER: { delay: 350, duration: 600 },
  CLOCK: { delay: 500, duration: 800 },
  BOTTOM: { delay: 750, duration: 550 },
};
const NOTIFICATION_GATE_MS = 1200;

export class LockScreenWake {
  constructor(shadowRoot) {
    this._shadowRoot = shadowRoot;
    this._ready = Promise.resolve();
  }

  /** The wake gate promise — notifications queue behind this */
  get ready() {
    return this._ready;
  }

  /** Run staggered WAAPI entrance, sets this.ready promise */
  play() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Reduced motion: single short fade
      const root = this._shadowRoot.querySelector('.lock-screen');
      if (root) {
        root.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: DURATION_QUICK,
          easing: 'ease',
        });
      }
      return;
    }

    const DECELERATE = DECELERATE_EASING;
    // Hide child content before stagger — keep .lock-screen background visible
    const childSels = [
      '.status-bar',
      '.date-weather',
      '.time-stacked',
      '.bottom-section',
    ];
    for (const sel of childSels) {
      const el = this._shadowRoot.querySelector(sel);
      if (el) el.style.opacity = '0';
    }

    const elements = [
      {
        sel: '.lock-screen',
        delay: WAKE.BG.delay,
        dur: WAKE.BG.duration,
        kf: [
          { opacity: 0.7, transform: 'scale(1.04)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
      },
      {
        sel: '.status-bar',
        delay: WAKE.STATUSBAR.delay,
        dur: WAKE.STATUSBAR.duration,
        kf: [{ opacity: 0 }, { opacity: 1 }],
      },
      {
        sel: '.date-weather',
        delay: WAKE.DATE_WEATHER.delay,
        dur: WAKE.DATE_WEATHER.duration,
        kf: [
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
      },
      {
        sel: '.time-stacked',
        delay: WAKE.CLOCK.delay,
        dur: WAKE.CLOCK.duration,
        kf: [
          { opacity: 0, transform: 'scale(0.92)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
      },
      {
        sel: '.bottom-section',
        delay: WAKE.BOTTOM.delay,
        dur: WAKE.BOTTOM.duration,
        kf: [{ opacity: 0 }, { opacity: 1 }],
      },
    ];

    const anims = [];
    for (const { sel, delay, dur, kf } of elements) {
      const el = this._shadowRoot.querySelector(sel);
      if (el) {
        const anim = el.animate(kf, {
          duration: dur,
          delay,
          easing: DECELERATE,
          fill: 'forwards',
        });
        // Commit final values as inline styles before cancelling so
        // identity transforms (scale(1), translateY(0)) persist and
        // the compositor layer isn't torn down (prevents snap-back).
        anims.push(
          anim.finished.then(() => {
            anim.commitStyles();
            anim.cancel();
            el.style.opacity = '';
          }),
        );
      }
    }
    // Notifications gate: appear after fingerprint is mostly faded in.
    // Bottom-section starts at 750ms + ~450ms to reach full opacity = ~1200ms.
    this._ready = new Promise((r) => setTimeout(r, NOTIFICATION_GATE_MS));
  }
}
