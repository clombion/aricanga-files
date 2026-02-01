// Ink Bridge - Connects ink story to JS events
// Binds external functions, observes variables, emits semantic events

import {
  eventBus,
  timeContext,
  EVENTS,
  createDataRequestEvent,
} from '@narratives/framework';
import { i18n } from './services/i18n.js';

export class InkBridge extends EventTarget {
  /**
   * @param {object} story - The inkjs Story instance
   * @param {function} getCurrentView - Returns current view from state machine
   */
  constructor(story, getCurrentView) {
    super();
    this.story = story;
    this.getCurrentView = getCurrentView;
    this._pendingDataRequest = null;
    this._dataRequestId = 0;
    this.bindExternalFunctions();
    this.subscribeToDataEvents();
  }

  // ============================================================================
  // Type-safe variable accessors
  // Validates and casts ink variables to expected JS types
  // ============================================================================

  /**
   * Get ink variable as string with validation
   * @param {string} name - Variable name
   * @param {string} [defaultValue=''] - Default if undefined/null
   * @returns {string}
   */
  getVariableString(name, defaultValue = '') {
    const val = this.story?.variablesState?.[name];
    if (val === undefined || val === null) return defaultValue;
    if (typeof val !== 'string') {
      console.warn(
        `Ink var "${name}" expected string, got ${typeof val}:`,
        val,
      );
      return String(val);
    }
    return val;
  }

  /**
   * Get ink variable as number with validation
   * @param {string} name - Variable name
   * @param {number} [defaultValue=0] - Default if undefined/null/NaN
   * @returns {number}
   */
  getVariableNumber(name, defaultValue = 0) {
    const val = this.story?.variablesState?.[name];
    if (val === undefined || val === null) return defaultValue;
    const num = Number(val);
    if (Number.isNaN(num)) {
      console.warn(`Ink var "${name}" is not a number:`, val);
      return defaultValue;
    }
    return num;
  }

  /**
   * Get ink variable as boolean with validation
   * Handles ink's 0/1 booleans and string conversions
   * @param {string} name - Variable name
   * @param {boolean} [defaultValue=false] - Default if undefined/null
   * @returns {boolean}
   */
  getVariableBoolean(name, defaultValue = false) {
    const val = this.story?.variablesState?.[name];
    if (val === undefined || val === null) return defaultValue;
    // Ink booleans are 0/1, but also handle true/false strings
    if (typeof val === 'boolean') return val;
    if (val === 1 || val === 'true') return true;
    if (val === 0 || val === 'false') return false;
    console.warn(`Ink var "${name}" expected boolean, got:`, val);
    return Boolean(val);
  }

  /**
   * Get current_chat variable with type safety
   * @returns {string} Chat ID or empty string
   */
  getCurrentChat() {
    return this.getVariableString('current_chat', '');
  }

  /**
   * Set current_chat variable
   * @param {string} chatId - Chat ID to set
   */
  setCurrentChat(chatId) {
    if (this.story?.variablesState) {
      // CQO-15 exception: InkBridge is the canonical accessor for ink variables
      this.story.variablesState.current_chat = chatId;
    }
  }

  /**
   * Set an arbitrary ink variable with type coercion
   * Used by debug panel and external data injection
   * @param {string} name - Variable name
   * @param {*} value - Value to set
   */
  setVariable(name, value) {
    if (this.story?.variablesState) {
      // CQO-15 exception: InkBridge is the canonical accessor for ink variables
      this.story.variablesState[name] = value;
    }
  }

  bindExternalFunctions() {
    // delay_next: Store on story object for processStoryChunk to read
    // This avoids direct XState context mutation during story.Continue()
    this.story.BindExternalFunction('delay_next', (ms) => {
      this.story._capturedDelay = ms;
    });

    // NOTE: Notifications are emergent - they fire automatically when messages
    // target a background chat via # targetChat: tag. No external function needed.
    // See docs/concepts/simulation-physics.md#emergent-notification-model

    // play_sound: Placeholder for future audio implementation
    this.story.BindExternalFunction('play_sound', (soundId) => {
      this.dispatchEvent(
        new CustomEvent('sound-requested', { detail: { soundId } }),
      );
    });

    // advance_day: Move to next day, reset time to morning
    // Usage in ink: ~ advance_day()
    this.story.BindExternalFunction('advance_day', () => {
      timeContext.advanceDay();
    });

    // request_data: Request external data (async)
    // Usage in ink: ~ request_data("source", "query_type", "entity_id")
    // Result is received via DATA_RECEIVED event and stored in ink variables
    this.story.BindExternalFunction('request_data', (source, query, params) => {
      const requestId = `data_${++this._dataRequestId}`;
      this._pendingDataRequest = { requestId, source, query, params };

      // Signal that story should pause for async data
      this.story._awaitingData = true;

      // Emit request event - DataService will handle and respond
      eventBus.emit(
        EVENTS.DATA_REQUESTED,
        createDataRequestEvent(requestId, source, query, params),
      );
    });

    // name: Get localized name variant for entity or character
    // Usage in ink: {name("character_id", "first_name")} → "Maria"
    //               {name("entity_id", "short")} → "Entity Name"
    // Enables locale switching without recompiling ink
    this.story.BindExternalFunction('name', (id, variant = 'short') => {
      return i18n.getName(id, variant);
    });
  }

  /**
   * Subscribe to data events from DataService
   */
  subscribeToDataEvents() {
    eventBus.on(EVENTS.DATA_RECEIVED, (e) => {
      this.handleDataReceived(e.detail);
    });

    eventBus.on(EVENTS.DATA_ERROR, (e) => {
      this.handleDataError(e.detail);
    });
  }

  /**
   * Handle received data from DataService
   * Sets ink variables and dispatches event to resume story
   * @param {Object} detail
   */
  handleDataReceived(detail) {
    const { requestId, data } = detail;

    // Verify this is the request we're waiting for
    if (!this._pendingDataRequest) return;
    if (this._pendingDataRequest.requestId !== requestId) return;

    // Set result in ink variables
    // Ink authors can read these with: {data_found}, {data_result}
    // CQO-15 exception: InkBridge is the canonical accessor for ink variables
    try {
      this.story.variablesState.data_found = data.found ?? false;
      this.story.variablesState.data_result = JSON.stringify(data);

      // Set specific fields as individual variables for easier ink access
      if (data.found) {
        if (data.owner_name) {
          this.story.variablesState.data_owner_name = data.owner_name;
        }
        if (data.company_name) {
          this.story.variablesState.data_company_name = data.company_name;
        }
        if (data.ownership_percent !== undefined) {
          this.story.variablesState.data_ownership_percent =
            data.ownership_percent;
        }
        if (data.discrepancy_percent !== undefined) {
          this.story.variablesState.data_discrepancy_percent =
            data.discrepancy_percent;
        }
      }
    } catch (_e) {
      // Variables might not exist in ink, that's fine
    }

    // Clear pending state
    this._pendingDataRequest = null;
    this.story._awaitingData = false;

    // Dispatch event to resume story processing
    this.dispatchEvent(
      new CustomEvent('data-ready', {
        detail: { requestId, data },
      }),
    );
  }

  /**
   * Handle data fetch error
   * @param {Object} detail
   */
  handleDataError(detail) {
    const { requestId, error } = detail;

    if (!this._pendingDataRequest) return;
    if (this._pendingDataRequest.requestId !== requestId) return;

    // Set error state in ink
    // CQO-15 exception: InkBridge is the canonical accessor for ink variables
    try {
      this.story.variablesState.data_found = false;
      this.story.variablesState.data_error = error;
    } catch (_e) {
      // Variables might not exist
    }

    this._pendingDataRequest = null;
    this.story._awaitingData = false;

    this.dispatchEvent(
      new CustomEvent('data-ready', {
        detail: { requestId, error },
      }),
    );
  }

}
