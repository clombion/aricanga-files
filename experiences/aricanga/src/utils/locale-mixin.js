/**
 * locale-mixin.js - Locale reactivity for experience page components
 *
 * Subscribes to LOCALE_READY and LOCALE_CHANGED events, calling a callback
 * on change. Returns connect/disconnect methods for use in Web Component
 * lifecycle hooks.
 */

import { eventBus } from '@narratives/framework';
import { I18N_EVENTS } from '../services/i18n.js';

/**
 * @param {Function} callback - Called when locale changes (typically re-render)
 * @returns {{ connect: Function, disconnect: Function }}
 */
export function withLocaleReactivity(callback) {
  return {
    connect() {
      eventBus.on(I18N_EVENTS.LOCALE_READY, callback);
      eventBus.on(I18N_EVENTS.LOCALE_CHANGED, callback);
    },
    disconnect() {
      eventBus.off(I18N_EVENTS.LOCALE_READY, callback);
      eventBus.off(I18N_EVENTS.LOCALE_CHANGED, callback);
    },
  };
}
