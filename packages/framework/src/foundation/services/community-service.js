// Community Service - Read-side API for "Telltale-style" choice stats
// GDPR-safe: No session/user data sent, only reads aggregate stats

/**
 * CommunityService fetches aggregate choice statistics from the analytics server.
 * Enables "X% of players chose this" displays without tracking individual users.
 *
 * Features:
 * - Response caching with TTL
 * - Silent failure (gameplay continues without stats)
 * - Batch fetching for multiple choices
 */
export class CommunityService {
  #endpoint;
  #cache = new Map();
  #cacheTTL;

  /**
   * @param {Object} options
   * @param {string} options.endpoint - Analytics server URL
   * @param {number} [options.cacheTTL=60000] - Cache TTL in ms (default 1 min)
   */
  constructor(options = {}) {
    this.#endpoint = options.endpoint;
    this.#cacheTTL = options.cacheTTL ?? 60000; // 1 minute default
  }

  /**
   * Get choice statistics for one or more choice identifiers
   * Choice IDs follow format: "knotName:choiceIndex" (e.g., "interrogation:0")
   *
   * @param {string[]} choiceIds - Array of choice identifiers
   * @returns {Promise<Map<string, {total: number, percentage: number}>>}
   */
  async getChoiceStats(choiceIds, { signal } = {}) {
    if (!this.#endpoint || choiceIds.length === 0) {
      return new Map();
    }

    // Check cache first
    const results = new Map();
    const uncached = [];

    for (const id of choiceIds) {
      const cached = this.#getFromCache(id);
      if (cached) {
        results.set(id, cached);
      } else {
        uncached.push(id);
      }
    }

    // All cached? Return early
    if (uncached.length === 0) {
      return results;
    }

    // Fetch uncached from server
    try {
      const params = new URLSearchParams();
      for (const id of uncached) {
        params.append('choice', id);
      }

      const response = await fetch(
        `${this.#endpoint}/stats/choices?${params.toString()}`,
        signal ? { signal } : undefined,
      );

      if (!response.ok) {
        console.warn(
          '[CommunityService] Stats request failed:',
          response.status,
        );
        return results;
      }

      const data = await response.json();

      // Process response and cache
      if (data.choices) {
        for (const [id, stats] of Object.entries(data.choices)) {
          const entry = {
            total: stats.total ?? 0,
            percentage: stats.percentage ?? 0,
          };
          this.#setCache(id, entry);
          results.set(id, entry);
        }
      }
    } catch (err) {
      // Silent fail - stats are optional
      console.warn('[CommunityService] Failed to fetch stats:', err.message);
    }

    return results;
  }

  /**
   * Get stats for a single choice
   * @param {string} knotName - Knot where choice appears
   * @param {number} choiceIndex - Index of choice in the knot
   * @returns {Promise<{total: number, percentage: number}|null>}
   */
  async getChoiceStat(knotName, choiceIndex) {
    const id = `${knotName}:${choiceIndex}`;
    const results = await this.getChoiceStats([id]);
    return results.get(id) ?? null;
  }

  /**
   * Clear the cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.#cache.clear();
  }

  /**
   * Check if service is configured
   * @returns {boolean}
   */
  isEnabled() {
    return Boolean(this.#endpoint);
  }

  #getFromCache(id) {
    const entry = this.#cache.get(id);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.#cacheTTL) {
      this.#cache.delete(id);
      return null;
    }

    return entry.data;
  }

  #setCache(id, data) {
    this.#cache.set(id, {
      data,
      timestamp: Date.now(),
    });
  }
}
