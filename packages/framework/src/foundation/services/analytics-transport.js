// Analytics Transport - Batch and beacon-based event delivery
// Silent-fail design: analytics should never break gameplay

/**
 * Send batch of events to analytics endpoint
 * Uses keepalive for reliability on page transitions
 *
 * @param {string} sessionId - Session identifier
 * @param {Array} entries - Event entries to send
 * @param {Object} config - { endpoint: string }
 * @returns {Promise<boolean>} - true if sent successfully
 */
export async function sendBatch(sessionId, entries, config) {
  if (!config?.endpoint || entries.length === 0) {
    return false;
  }

  try {
    const response = await fetch(`${config.endpoint}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, entries }),
      keepalive: true, // Survive page unload
    });
    return response.ok;
  } catch (err) {
    // Silent fail - analytics shouldn't break gameplay
    console.warn('[Analytics] Batch send failed:', err.message);
    return false;
  }
}

/**
 * Send exit event via beacon API (guaranteed delivery on unload)
 * Used for capturing session end even on abrupt tab close
 *
 * @param {Object} logger - EventLogger instance
 * @param {Object} runtime - InkRuntime instance (for knot context)
 * @param {Object} config - { endpoint: string }
 * @returns {boolean} - true if beacon was queued
 */
export function sendBeaconExit(logger, runtime, config) {
  if (!config?.endpoint) {
    return false;
  }

  // navigator.sendBeacon isn't available in all contexts
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
    // Fallback to sync batch send
    const entries = logger.getSessionEntries();
    if (entries.length > 0) {
      sendBatch(logger.getSessionId(), entries, config);
    }
    return false;
  }

  try {
    // Build exit event with context
    const exitPath = runtime?.story?.state?.currentPathString ?? null;
    const exitVisitCount =
      exitPath && runtime?.story
        ? runtime.story.state.VisitCountAtPathString(exitPath)
        : 0;

    const exitEvent = {
      id: crypto.randomUUID(),
      type: 'session_exit',
      timestamp: Date.now(),
      sessionId: logger.getSessionId(),
      payload: {
        reason: 'page_unload',
        eventCount: logger.getSessionEntries().length,
      },
      context: {
        knot: runtime?.getCurrentKnot?.() ?? null,
        exitPath,
        visitsToExitPath: exitVisitCount,
      },
    };

    // Send all session entries + exit event
    const entries = [...logger.getSessionEntries(), exitEvent];
    const blob = new Blob(
      [JSON.stringify({ sessionId: logger.getSessionId(), entries })],
      { type: 'application/json' },
    );

    return navigator.sendBeacon(`${config.endpoint}/batch`, blob);
  } catch (err) {
    console.warn('[Analytics] Beacon send failed:', err.message);
    return false;
  }
}

/**
 * Setup exit tracking on all relevant browser events
 * Handles: pagehide, beforeunload, visibilitychange (hidden)
 *
 * @param {Object} logger - EventLogger instance
 * @param {Object} runtime - InkRuntime instance
 * @param {Object} config - { endpoint: string }
 * @returns {Function} - Cleanup function to remove listeners
 */
export function setupExitTracking(logger, runtime, config) {
  if (!config?.endpoint) {
    return () => {};
  }

  let exitSent = false;

  const handleExit = () => {
    if (exitSent) return;
    exitSent = true;
    sendBeaconExit(logger, runtime, config);
  };

  // pagehide - most reliable for mobile/tab close
  const pagehideHandler = () => handleExit();

  // beforeunload - fallback for desktop browsers
  const beforeunloadHandler = () => handleExit();

  // visibilitychange - catch mobile app switches
  const visibilityHandler = () => {
    if (document.visibilityState === 'hidden') {
      handleExit();
    }
  };

  window.addEventListener('pagehide', pagehideHandler);
  window.addEventListener('beforeunload', beforeunloadHandler);
  document.addEventListener('visibilitychange', visibilityHandler);

  // Return cleanup function
  return () => {
    window.removeEventListener('pagehide', pagehideHandler);
    window.removeEventListener('beforeunload', beforeunloadHandler);
    document.removeEventListener('visibilitychange', visibilityHandler);
  };
}
