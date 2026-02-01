// Data Service - Async API handler for external data sources
// Listens for DATA_REQUESTED events, fetches data, emits DATA_RECEIVED/DATA_ERROR

import {
  eventBus,
  EVENTS,
  createDataErrorEvent,
  createDataResponseEvent,
} from '@narratives/framework';

/**
 * Mock data for external data requests
 * Replace with real API calls or your own mock data for your story
 *
 * Structure: { query_type: { entity_id: { found: true, ...data } } }
 * Usage in ink: ~ request_data("source", "query_type", "entity_id")
 */
const MOCK_DATA = {
  // Example: beneficial ownership data
  beneficial_owners: {
    example_company: {
      found: true,
      company_name: 'Example Corp',
      owner_name: 'Jane Doe',
      ownership_percent: 51,
      registered_country: 'Example Country',
      registration_date: '2020-01-15',
      related_entities: ['Related Corp LLC'],
    },
  },
  // Example: license/permit data
  licenses: {
    example_company: {
      found: true,
      license_number: 'LIC-2020-0001',
      granted_date: '2020-06-18',
      expiry_date: '2045-06-17',
      status: 'active',
    },
  },
  // Example: financial data
  financial_records: {
    example_company: {
      found: true,
      year: 2024,
      revenue: 1000000,
      tax_paid: 150000,
      audit_status: 'pending',
    },
  },
  // Example: registry data
  company_registry: {
    example_company: {
      found: true,
      full_name: 'Example Corporation Ltd',
      status: 'active',
      directors: ['Jane Doe', 'John Smith'],
      registered_address: '123 Example Street',
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
    this._pendingRequests = new Map();
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
   * @param {string} detail.params - Query parameters (e.g., 'example_company')
   * @param {string} [detail.requestId] - Optional request ID
   */
  async handleRequest({ source, query, params, requestId }) {
    const id = requestId || this.generateRequestId();

    try {
      // Simulate network delay for realism
      await this.simulateNetworkDelay();

      const data = await this.fetch(source, query, params);

      eventBus.emit(
        EVENTS.DATA_RECEIVED,
        createDataResponseEvent(id, source, query, params, data),
      );
    } catch (error) {
      eventBus.emit(
        EVENTS.DATA_ERROR,
        createDataErrorEvent(
          id,
          source,
          query,
          params,
          error.message || 'Unknown error',
        ),
      );
    }
  }

  /**
   * Simulate network delay (500-1500ms)
   * Respects prefers-reduced-motion
   */
  async simulateNetworkDelay() {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReduced) return;

    const delay = 500 + Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
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
   * Fetch from mock data
   * @param {string} query - Query type (beneficial_owners, licenses, etc.)
   * @param {string} params - Entity to look up (e.g., 'example_company')
   * @returns {Object}
   */
  fetchEITI(query, params) {
    const queryData = MOCK_DATA[query];

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
