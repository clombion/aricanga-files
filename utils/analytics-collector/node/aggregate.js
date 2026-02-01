// Aggregation functions for player analytics

/**
 * Compute path statistics from logged events
 * @param {Array} entries - Array of log entries
 * @returns {Object} - { totalChoices, uniqueSessions, pathDistribution }
 */
export function computePathStats(entries) {
  const choices = entries.filter((e) => e.type === 'choice');

  // Group by knotPath -> choiceIndex -> { count, text }
  const byPath = {};
  const sessions = new Set();

  for (const c of choices) {
    sessions.add(c.sessionId);

    const path = c.payload?.knotPath || 'unknown';
    const choiceIndex = c.payload?.choiceIndex ?? -1;

    byPath[path] ??= {};
    byPath[path][choiceIndex] ??= {
      count: 0,
      text: c.payload?.choiceText || '',
    };
    byPath[path][choiceIndex].count++;
  }

  return {
    totalChoices: choices.length,
    uniqueSessions: sessions.size,
    pathDistribution: byPath,
  };
}

/**
 * Compute session summaries
 * @param {Array} entries - Array of log entries
 * @returns {Array} - Array of session summaries
 */
export function computeSessionSummaries(entries) {
  const sessions = {};

  for (const entry of entries) {
    const sid = entry.sessionId;
    sessions[sid] ??= {
      sessionId: sid,
      startTime: entry.timestamp,
      endTime: entry.timestamp,
      choiceCount: 0,
      paths: new Set(),
    };

    const s = sessions[sid];
    s.startTime = Math.min(s.startTime, entry.timestamp);
    s.endTime = Math.max(s.endTime, entry.timestamp);

    if (entry.type === 'choice') {
      s.choiceCount++;
      if (entry.payload?.knotPath) {
        s.paths.add(entry.payload.knotPath);
      }
    }
  }

  return Object.values(sessions).map((s) => ({
    ...s,
    paths: [...s.paths],
    durationMs: s.endTime - s.startTime,
  }));
}

/**
 * Find most common choice paths
 * @param {Array} entries - Array of log entries
 * @param {number} limit - Number of top paths to return
 * @returns {Array} - Top paths by frequency
 */
export function topPaths(entries, limit = 10) {
  const choices = entries.filter((e) => e.type === 'choice');
  const pathCounts = {};

  for (const c of choices) {
    const path = c.payload?.knotPath || 'unknown';
    pathCounts[path] ??= 0;
    pathCounts[path]++;
  }

  return Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path, count]) => ({ path, count }));
}

/**
 * Compute statistics for specific choice IDs (Telltale-style)
 * Choice ID format: "knotName:choiceIndex" (e.g., "interrogation:0")
 *
 * @param {Array} entries - Array of log entries
 * @param {string[]} choiceIds - Array of choice IDs to query
 * @returns {Object} - { choices: { "knot:0": { total, percentage } } }
 */
export function computeChoiceStats(entries, choiceIds) {
  const choices = entries.filter((e) => e.type === 'choice');

  // Count totals per knot for percentage calculation
  const knotTotals = {};
  const choiceCounts = {};

  for (const c of choices) {
    const knot = c.payload?.knotPath || c.context?.knot || 'unknown';
    const idx = c.payload?.choiceIndex ?? -1;
    const key = `${knot}:${idx}`;

    // Count per knot
    knotTotals[knot] ??= 0;
    knotTotals[knot]++;

    // Count per choice
    choiceCounts[key] ??= { count: 0, knot };
    choiceCounts[key].count++;
  }

  // Build response for requested choice IDs
  const result = {};
  for (const id of choiceIds) {
    const [knot] = id.split(':');
    const data = choiceCounts[id];

    if (data) {
      const total = knotTotals[knot] || 1;
      result[id] = {
        total: data.count,
        percentage: Math.round((data.count / total) * 100),
      };
    } else {
      result[id] = { total: 0, percentage: 0 };
    }
  }

  return { choices: result };
}
