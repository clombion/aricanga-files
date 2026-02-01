// Storage Adapter - Abstracts localStorage for testability
// Part of vocabulary-agnostic foundation layer
// Can be swapped for IndexedDB or mock storage in tests

/**
 * Create a storage adapter for a specific key namespace
 * @param {string} key - Storage key prefix
 * @returns {Object} Storage adapter with save/load/clear methods
 */
export function createStorageAdapter(key) {
  return {
    /**
     * Save data to storage
     * @param {Object} data - Data to persist
     * @returns {boolean} Success status
     */
    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (e) {
        console.error(`Failed to save state to "${key}":`, e);
        return false;
      }
    },

    /**
     * Load data from storage
     * @returns {Object|null} Saved data or null
     */
    load() {
      try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        console.warn(`Failed to load state from "${key}":`, e);
        return null;
      }
    },

    /**
     * Clear saved data
     * @returns {boolean} Success status
     */
    clear() {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        console.error(`Failed to clear state from "${key}":`, e);
        return false;
      }
    },
  };
}

// Default storage instance (for backward compatibility)
export const storage = createStorageAdapter('gameState');
