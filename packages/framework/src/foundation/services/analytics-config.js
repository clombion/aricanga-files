// Analytics Configuration
// Default configuration for analytics - can be overridden at runtime

/**
 * Default analytics configuration
 * Analytics is disabled by default for privacy
 */
const DEFAULT_CONFIG = {
  enabled: false,
  endpoint: '', // Empty = local logging only
  retention: {
    maxAgeDays: 7,
    maxEntries: 5000,
  },
};

/**
 * Get analytics configuration
 * Merges defaults with any runtime overrides
 *
 * @param {Object} [overrides] - Configuration overrides
 * @returns {{enabled: boolean, endpoint: string, retention: {maxAgeDays: number, maxEntries: number}}}
 */
export function getAnalyticsConfig(overrides = {}) {
  return {
    enabled: overrides.enabled ?? DEFAULT_CONFIG.enabled,
    endpoint: overrides.endpoint ?? DEFAULT_CONFIG.endpoint,
    retention: {
      ...DEFAULT_CONFIG.retention,
      ...overrides.retention,
    },
  };
}

/**
 * Check if analytics should be active
 * @param {Object} config - Analytics config
 * @returns {boolean}
 */
export function isAnalyticsEnabled(config) {
  return config?.enabled === true;
}

/**
 * Check if remote analytics (server reporting) is enabled
 * @param {Object} config - Analytics config
 * @returns {boolean}
 */
export function isRemoteEnabled(config) {
  return isAnalyticsEnabled(config) && Boolean(config?.endpoint);
}
