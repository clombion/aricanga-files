// tests/e2e/transition-forensics.spec.ts
// Parallax transition regression tests (task-105)
//
// Verifies the hub→thread slide-left transition runs the full 300ms
// with Material 3 Emphasized easing and no visual discontinuity.
//
// Instrumentation: rAF transform sampling via MutationObserver on hidden attr.
// Cross-browser (no CDP dependency).

import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { ChatHub, ChatThread, Notification } from '@narratives/test-utils/pages';
import { waitForGameInitSettled, unlockLockScreen } from '@narratives/test-utils/helpers';
import {
  MESSAGE_MARKERS,
  NOTIFICATIONS,
} from '../fixtures/story-expectations';

// ── Forensic instrumentation helpers ─────────────────────────────────

/**
 * Inject rAF transform sampling on chat-thread.
 * Call BEFORE triggering a transition. The MutationObserver fires
 * when hidden is removed, starts an rAF loop for 700ms, and records
 * { t, transform } snapshots relative to the visibility change.
 */
async function injectForensics(page: any) {
  await page.evaluate(() => {
    const w = window as any;
    w.__forensics = {
      transforms: [] as { t: number; transform: string }[],
      hiddenRemovedAt: 0,
      firstAnimFrameAt: 0,
      stoppedAt: 0,
      samplingActive: false,
    };

    const thread = document.querySelector('chat-thread');
    if (!thread) return;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          m.type === 'attributes' &&
          m.attributeName === 'hidden' &&
          !(m.target as HTMLElement).hidden
        ) {
          w.__forensics.hiddenRemovedAt = performance.now();

          w.__forensics.samplingActive = true;
          const sample = () => {
            if (!w.__forensics.samplingActive) return;
            const transform = getComputedStyle(thread).transform;
            const t = performance.now();
            if (w.__forensics.transforms.length === 0) {
              w.__forensics.firstAnimFrameAt = t;
            }
            w.__forensics.transforms.push({ t, transform });
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);

          setTimeout(() => {
            w.__forensics.samplingActive = false;
            w.__forensics.stoppedAt = performance.now();
          }, 700);

          observer.disconnect();
        }
      }
    });

    observer.observe(thread, { attributes: true, attributeFilter: ['hidden'] });
  });
}

/** Read and analyze forensic data after transition completes. */
async function readForensics(page: any) {
  return page.evaluate(() => {
    const w = window as any;
    const f = w.__forensics;
    if (!f || f.hiddenRemovedAt === 0) return null;

    const parseTranslateX = (t: string): number | null => {
      if (t === 'none') return 0;
      const match = t.match(/matrix\(([^)]+)\)/);
      if (!match) return null;
      return Number(match[1].split(',')[4]) ?? null;
    };

    const samples = f.transforms.map((s: any) => ({
      t: Math.round(s.t - f.hiddenRemovedAt),
      transform: s.transform,
      translateX: parseTranslateX(s.transform),
    }));

    const hasIdentityAtStart =
      samples.length > 0 && samples[0].translateX === 0;

    let maxJump = 0;
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1].translateX;
      const curr = samples[i].translateX;
      if (prev !== null && curr !== null)
        maxJump = Math.max(maxJump, Math.abs(curr - prev));
    }

    // Find animation end: first frame where translateX reaches 0 after being non-zero
    let animEndTime = 0;
    for (let i = 1; i < samples.length; i++) {
      if (
        samples[i].translateX === 0 &&
        samples[i - 1].translateX !== null &&
        samples[i - 1].translateX !== 0
      ) {
        animEndTime = samples[i].t;
        break;
      }
    }

    let maxGap = 0;
    for (let i = 1; i < samples.length; i++)
      maxGap = Math.max(maxGap, samples[i].t - samples[i - 1].t);

    return {
      sampleCount: samples.length,
      visibilityToFirstRAF: Math.round(f.firstAnimFrameAt - f.hiddenRemovedAt),
      hasIdentityAtStart,
      maxJump: Math.round(maxJump),
      animEndTime: Math.round(animEndTime),
      maxFrameGap: Math.round(maxGap),
      stoppedAt: Math.round(f.stoppedAt - f.hiddenRemovedAt),
      firstSampleTranslateX: samples[0]?.translateX ?? null,
    };
  });
}

/** Navigate to hub → news → back to hub (Pat notification already in drawer from game_init). */
async function setupNotificationHeavyState(
  hub: ChatHub,
  thread: ChatThread,
  page: any,
  clock: any,
) {
  await hub.openChat('news');
  await clock.advance(COMMON_DELAYS.MAX);
  await thread.waitForMessage(MESSAGE_MARKERS.news.first);
  await thread.goBack();
}

/**
 * Inject scrollIntoView timing instrumentation.
 * Monkey-patches Element.prototype.scrollIntoView to record when it's called
 * relative to the chat-thread hidden→visible transition.
 * Also records when the WAAPI animation ends via a MutationObserver + rAF loop.
 */
async function injectScrollTimingProbe(page: any) {
  await page.evaluate(() => {
    const w = window as any;
    w.__scrollProbe = {
      scrollIntoViewCalledAt: 0,
      hiddenRemovedAt: 0,
      animEndAt: 0,
    };

    // Monkey-patch scrollIntoView on the unread-separator
    const origScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args: any[]) {
      if (this.tagName === 'UNREAD-SEPARATOR') {
        w.__scrollProbe.scrollIntoViewCalledAt = performance.now();
      }
      return origScrollIntoView.apply(this, args);
    };

    // Track when chat-thread becomes visible and when its animation ends
    const thread = document.querySelector('chat-thread');
    if (!thread) return;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          m.type === 'attributes' &&
          m.attributeName === 'hidden' &&
          !(m.target as HTMLElement).hidden
        ) {
          w.__scrollProbe.hiddenRemovedAt = performance.now();

          // Sample transform to detect when animation reaches translateX(0)
          const checkEnd = () => {
            const transform = getComputedStyle(thread).transform;
            const isAtRest = transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
            if (isAtRest && performance.now() - w.__scrollProbe.hiddenRemovedAt > 100) {
              // Animation has ended (past initial setup, now at rest)
              w.__scrollProbe.animEndAt = performance.now();
            } else if (performance.now() - w.__scrollProbe.hiddenRemovedAt < 800) {
              requestAnimationFrame(checkEnd);
            }
          };
          requestAnimationFrame(checkEnd);
          observer.disconnect();
        }
      }
    });
    observer.observe(thread, { attributes: true, attributeFilter: ['hidden'] });
  });
}

async function readScrollTimingProbe(page: any) {
  return page.evaluate(() => {
    const w = window as any;
    const p = w.__scrollProbe;
    if (!p || p.hiddenRemovedAt === 0) return null;

    return {
      scrollCalledAt: Math.round(p.scrollIntoViewCalledAt - p.hiddenRemovedAt),
      animEndAt: Math.round(p.animEndAt - p.hiddenRemovedAt),
      scrollCalledDuringAnimation:
        p.scrollIntoViewCalledAt > 0 &&
        p.animEndAt > 0 &&
        p.scrollIntoViewCalledAt < p.animEndAt,
      scrollIntoViewCalled: p.scrollIntoViewCalledAt > 0,
    };
  });
}

// ── Regression tests (Phase 3) ──────────────────────────────────────

test.describe('Parallax Transition Regression', () => {
  test('lightweight chat: full 300ms parallax with no discontinuity', async ({
    page,
  }) => {
    const hub = new ChatHub(page);
    await hub.goto();

    await injectForensics(page);
    await hub.openChat('news');
    await page.waitForTimeout(800);

    const data = await readForensics(page);
    expect(data).not.toBeNull();

    // Animation must start off-screen (translateX > 0), not at resting position
    expect(data!.hasIdentityAtStart).toBe(false);
    expect(data!.firstSampleTranslateX).toBeGreaterThan(300);

    // Animation must complete within expected range (300ms ± 50ms)
    expect(data!.animEndTime).toBeGreaterThan(250);
    expect(data!.animEndTime).toBeLessThan(400);

    // No frame drops (max gap should be ≤ 2 frames)
    expect(data!.maxFrameGap).toBeLessThan(35);

    // Sufficient sample count (at 60fps, 300ms ≈ 18 frames)
    expect(data!.sampleCount).toBeGreaterThan(12);
  });

  test('notification-heavy chat: full 300ms parallax with no discontinuity', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    await hub.goto();
    await waitForGameInitSettled(page);
    const clock = await installClock();
    await setupNotificationHeavyState(hub, thread, page, clock);

    await injectForensics(page);
    await hub.openChat('pat');
    await page.waitForTimeout(800);

    const data = await readForensics(page);
    expect(data).not.toBeNull();

    // Same assertions as baseline — heavy chat must behave identically
    expect(data!.hasIdentityAtStart).toBe(false);
    expect(data!.firstSampleTranslateX).toBeGreaterThan(300);
    expect(data!.animEndTime).toBeGreaterThan(250);
    expect(data!.animEndTime).toBeLessThan(400);
    expect(data!.maxFrameGap).toBeLessThan(35);
    expect(data!.sampleCount).toBeGreaterThan(12);
  });

  // Skip: Story rework (1d78192) changed game_init flow — on fresh start, news has no
  // lastReadMessageId so no unread-separator is rendered and scrollIntoView isn't called.
  test.skip('unread chat: scrollIntoView must not fire during parallax animation', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);

    // Fresh start — News has unread messages (seed + new from story init)
    // and lastReadMessageId is set by the first notification-triggering message.
    // This produces an unread-separator, triggering scrollIntoView.
    await hub.goto();
    await waitForGameInitSettled(page);

    await injectScrollTimingProbe(page);
    await hub.openChat('news');
    await page.waitForTimeout(800);

    const data = await readScrollTimingProbe(page);
    expect(data).not.toBeNull();

    // scrollIntoView MUST have been called (unread separator exists for news)
    expect(data!.scrollIntoViewCalled).toBe(true);

    // It must NOT fire during the animation (before ~300ms)
    expect(data!.scrollCalledDuringAnimation).toBe(false);
    expect(data!.scrollCalledAt).toBeGreaterThan(200);
  });

  test('game restart: parallax after reload with saved state', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    // First session: advance story to create saved state
    await hub.goto();
    await waitForGameInitSettled(page);
    const clock = await installClock();
    await hub.openChat('news');
    await clock.advance(COMMON_DELAYS.MAX);
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);
    await thread.goBack();

    // Reload WITHOUT clearing localStorage (simulates game restart)
    await page.goto('.');
    await unlockLockScreen(page);

    await injectForensics(page);
    await hub.openChat('pat');
    await page.waitForTimeout(800);

    const data = await readForensics(page);
    expect(data).not.toBeNull();

    expect(data!.hasIdentityAtStart).toBe(false);
    expect(data!.firstSampleTranslateX).toBeGreaterThan(300);
    expect(data!.animEndTime).toBeGreaterThan(250);
    expect(data!.animEndTime).toBeLessThan(400);
    expect(data!.maxFrameGap).toBeLessThan(35);
    expect(data!.sampleCount).toBeGreaterThan(20);
  });
});
