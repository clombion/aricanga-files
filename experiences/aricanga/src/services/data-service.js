// Data Service - Async API handler for external data sources
// Listens for DATA_REQUESTED events, fetches data, emits DATA_RECEIVED/DATA_ERROR

import {
  createDataErrorEvent,
  createDataResponseEvent,
  EVENTS,
  eventBus,
} from '@narratives/framework';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Mock EITI (Extractive Industries Transparency Initiative) data
 * In production, this would be fetched from real APIs
 */
const MOCK_EITI_DATA = {
  beneficial_owners: {
    aricanga: {
      found: true,
      company_name: 'Aricanga Mining Ltd',
      owner_name: 'Marcus Chen',
      ownership_percent: 67,
      registered_country: 'British Virgin Islands',
      registration_date: '2019-03-15',
      related_entities: ['Coastal Ventures LLC', 'Pacific Holdings SA'],
    },
    coastal_ventures: {
      found: true,
      company_name: 'Coastal Ventures LLC',
      owner_name: 'Marcus Chen',
      ownership_percent: 100,
      registered_country: 'Delaware, USA',
      registration_date: '2018-11-02',
      related_entities: ['Aricanga Mining Ltd'],
    },
  },
  mining_licenses: {
    aricanga: {
      found: true,
      license_number: 'ML-2020-4472',
      granted_date: '2020-06-18',
      expiry_date: '2045-06-17',
      area_hectares: 12500,
      minerals: ['copper', 'gold', 'silver'],
      environmental_assessment: 'pending',
    },
  },
  tax_payments: {
    aricanga: {
      found: true,
      year: 2024,
      corporate_tax: 0,
      royalties: 145000,
      expected_royalties: 2800000,
      discrepancy_percent: 95,
      audit_status: 'flagged',
    },
  },
  company_registry: {
    aricanga: {
      found: true,
      full_name: 'Aricanga Mining Limited',
      status: 'active',
      directors: ['Marcus Chen', 'Sarah Williams', 'James Okonkwo'],
      registered_address: 'PO Box 3847, Road Town, Tortola, BVI',
      local_representative: 'James Okonkwo',
    },
  },
  revenue_statistics: {
    mining_projects: {
      found: true,
      median_annual_revenue: 180000000, // $180 million (realistic raw value)
      sample_size: 47,
      years_covered: '2015-2024',
      source_url: 'https://soe-database.eiti.org/mining-revenues',
    },
  },
};

/**
 * DataService handles async data requests from ink narratives
 *
 * Flow:
 * 1. Ink calls ~ request_data("source", "query", "params")
 * 2. InkBridge emits DATA_REQUESTED
 * 3. DataService fetches data (mock or real)
 * 4. DataService emits DATA_RECEIVED or DATA_ERROR
 * 5. InkBridge calls ink function with result
 */
class DataService {
  constructor() {
    /** @type {Map<string, Promise<Object>>} dedup key → in-flight fetch promise */
    this._inflight = new Map();
    this._requestIdCounter = 0;
  }

  /**
   * Initialize the service and start listening for events
   */
  init() {
    eventBus.on(EVENTS.DATA_REQUESTED, (e) => {
      this.handleRequest(e.detail);
    });
  }

  /**
   * Generate unique request ID
   * @returns {string}
   */
  generateRequestId() {
    return `req_${++this._requestIdCounter}_${Date.now()}`;
  }

  /**
   * Handle incoming data request
   * @param {Object} detail - Request details
   * @param {string} detail.source - Data source (e.g., 'eiti')
   * @param {string} detail.query - Query type (e.g., 'beneficial_owners')
   * @param {string} detail.params - Query parameters (e.g., 'aricanga')
   * @param {string} [detail.requestId] - Optional request ID
   */
  async handleRequest({ source, query, params, requestId }) {
    const id = requestId || this.generateRequestId();
    const dedupKey = `${source}:${query}:${params}`;

    try {
      let data;

      if (this._inflight.has(dedupKey)) {
        // Reuse the in-flight fetch — one network call for concurrent identical requests
        data = await this._inflight.get(dedupKey);
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        const fetchPromise = (async () => {
          try {
            await this.simulateNetworkDelay(controller.signal);
            return await this.fetch(source, query, params);
          } finally {
            clearTimeout(timer);
          }
        })();

        this._inflight.set(dedupKey, fetchPromise);
        try {
          data = await fetchPromise;
        } finally {
          this._inflight.delete(dedupKey);
        }
      }

      eventBus.emit(
        EVENTS.DATA_RECEIVED,
        createDataResponseEvent(id, source, query, params, data),
      );
    } catch (error) {
      const message =
        error.name === 'AbortError'
          ? `Request timed out after ${DEFAULT_TIMEOUT_MS}ms`
          : error.message || 'Unknown error';

      eventBus.emit(
        EVENTS.DATA_ERROR,
        createDataErrorEvent(id, source, query, params, message),
      );
    }
  }

  /**
   * Simulate network delay (500-1500ms)
   * Respects prefers-reduced-motion
   */
  async simulateNetworkDelay(signal) {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReduced) return;

    const delay = 500 + Math.random() * 1000;
    await new Promise((resolve, reject) => {
      const tid = setTimeout(resolve, delay);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(tid);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  }

  /**
   * Fetch data from source
   * @param {string} source - Data source
   * @param {string} query - Query type
   * @param {string} params - Query parameters
   * @returns {Promise<Object>}
   */
  async fetch(source, query, params) {
    switch (source) {
      case 'eiti':
        return this.fetchEITI(query, params);
      default:
        throw new Error(`Unknown data source: ${source}`);
    }
  }

  /**
   * Fetch from EITI mock data
   * @param {string} query - Query type (beneficial_owners, mining_licenses, etc.)
   * @param {string} params - Entity to look up (e.g., 'aricanga')
   * @returns {Object}
   */
  fetchEITI(query, params) {
    const queryData = MOCK_EITI_DATA[query];

    if (!queryData) {
      return {
        found: false,
        error: `Unknown query type: ${query}`,
      };
    }

    const entityData = queryData[params.toLowerCase()];

    if (!entityData) {
      return {
        found: false,
        query,
        params,
        message: `No records found for "${params}" in ${query}`,
      };
    }

    return entityData;
  }

  /**
   * Register custom data source handler
   * @param {string} source - Source name
   * @param {Function} handler - Async handler function(query, params) => data
   */
  registerSource(source, handler) {
    this[`fetch${source.charAt(0).toUpperCase() + source.slice(1)}`] = handler;
  }
}

// Singleton instance
export const dataService = new DataService();
