// Context Registry - Simple service locator for cross-layer dependencies
// Allows implementations to register services that systems access through accessors

const registry = new Map();
const listeners = new Map(); // name → Set<callback>

/**
 * Context registry for decoupling systems from implementations.
 *
 * Usage:
 * - Implementation (main.js): contextRegistry.register('i18n', i18n);
 * - System accessor: contextRegistry.get('i18n')?.t(key);
 * - Wait for registration: contextRegistry.onRegister('config', (svc) => { ... });
 */
export const contextRegistry = {
  /**
   * Register a service. Fires any pending onRegister callbacks.
   * @param {string} name - Service identifier
   * @param {*} service - Service instance
   */
  register(name, service) {
    registry.set(name, service);
    const cbs = listeners.get(name);
    if (cbs) {
      listeners.delete(name);
      for (const cb of cbs) cb(service);
    }
  },

  /**
   * Get a registered service
   * @param {string} name - Service identifier
   * @returns {*} Service instance or undefined
   */
  get(name) {
    return registry.get(name);
  },

  /**
   * Register a one-shot callback for when a service is registered.
   * Fires immediately if already registered.
   * @param {string} name - Service identifier
   * @param {function} callback - Called with the service instance
   */
  onRegister(name, callback) {
    const existing = registry.get(name);
    if (existing !== undefined) {
      callback(existing);
      return;
    }
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(callback);
  },

  /**
   * Clear all registered services and pending listeners (for testing)
   */
  clear() {
    registry.clear();
    listeners.clear();
  },
};
