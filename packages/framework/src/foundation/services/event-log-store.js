// IndexedDB-backed event log storage for analytics
// Browser-native storage - no server dependency

const DB_NAME = 'eventLogs';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

// Default retention: 30 days, max 10000 entries
const DEFAULT_RETENTION = {
  maxAgeDays: 30,
  maxEntries: 10000,
};

/**
 * EventLogStore - Async IndexedDB wrapper for event logging
 *
 * Features:
 * - Indexed by type, sessionId, timestamp for efficient queries
 * - Auto-cleanup via retention policy
 * - Query and export APIs for analytics
 */
export class EventLogStore {
  #db = null;
  #retention;

  constructor(options = {}) {
    this.#retention = { ...DEFAULT_RETENTION, ...options.retention };
  }

  /**
   * Initialize IndexedDB connection
   * @returns {Promise<void>}
   */
  async init() {
    if (this.#db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.#db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type_session', ['type', 'sessionId'], {
            unique: false,
          });
        }
      };
    });
  }

  /**
   * Add a log entry
   * @param {Object} entry - Log entry with id, type, timestamp, sessionId, payload, context
   * @returns {Promise<void>}
   */
  async add(entry) {
    this.#ensureInit();

    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Query log entries with optional filters
   * @param {Object} filters - { type?, sessionId?, since?, until?, limit? }
   * @returns {Promise<Array>}
   */
  async query(filters = {}) {
    this.#ensureInit();

    const { type, sessionId, since, until, limit = 1000 } = filters;

    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const results = [];

      let request;

      // Use appropriate index based on filters
      if (type && sessionId) {
        const index = store.index('type_session');
        request = index.openCursor(IDBKeyRange.only([type, sessionId]));
      } else if (type) {
        const index = store.index('type');
        request = index.openCursor(IDBKeyRange.only(type));
      } else if (sessionId) {
        const index = store.index('sessionId');
        request = index.openCursor(IDBKeyRange.only(sessionId));
      } else {
        request = store.openCursor();
      }

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }

        const entry = cursor.value;
        const ts = entry.timestamp;

        // Apply timestamp filters
        if (since && ts < since) {
          cursor.continue();
          return;
        }
        if (until && ts > until) {
          cursor.continue();
          return;
        }

        results.push(entry);
        cursor.continue();
      };
    });
  }

  /**
   * Get aggregated choice statistics
   * @returns {Promise<Object>} - { totalChoices, uniqueSessions, pathDistribution }
   */
  async getChoiceStats() {
    const choices = await this.query({ type: 'choice' });

    const byPath = {};
    const sessions = new Set();

    for (const entry of choices) {
      sessions.add(entry.sessionId);

      const path = entry.payload?.knotPath || 'unknown';
      const choiceIndex = entry.payload?.choiceIndex ?? -1;

      byPath[path] ??= {};
      byPath[path][choiceIndex] ??= {
        count: 0,
        text: entry.payload?.choiceText || '',
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
   * Export all entries as JSON
   * @param {Object} filters - Optional filters (same as query)
   * @returns {Promise<Array>}
   */
  async exportJSON(filters = {}) {
    return this.query({ ...filters, limit: Infinity });
  }

  /**
   * Get entries for a specific session
   * @param {string} sessionId
   * @returns {Promise<Array>}
   */
  async getSession(sessionId) {
    return this.query({ sessionId });
  }

  /**
   * Clear all log entries
   * @returns {Promise<void>}
   */
  async clear() {
    this.#ensureInit();

    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Apply retention policy - delete old entries
   * @returns {Promise<number>} - Number of entries deleted
   */
  async prune() {
    this.#ensureInit();

    const cutoff =
      Date.now() - this.#retention.maxAgeDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    // First pass: delete by age
    await new Promise((resolve, reject) => {
      const tx = this.#db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };
    });

    // Second pass: enforce max entries
    const count = await this.#getCount();
    if (count > this.#retention.maxEntries) {
      const excess = count - this.#retention.maxEntries;
      deleted += await this.#deleteOldest(excess);
    }

    return deleted;
  }

  /**
   * Get total entry count
   * @returns {Promise<number>}
   */
  async #getCount() {
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Delete oldest N entries
   * @param {number} n
   * @returns {Promise<number>}
   */
  async #deleteOldest(n) {
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor();
      let deleted = 0;

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && deleted < n) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };
    });
  }

  #ensureInit() {
    if (!this.#db) {
      throw new Error('EventLogStore not initialized. Call init() first.');
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
  }
}
