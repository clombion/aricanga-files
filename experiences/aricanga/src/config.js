// Config - Re-exports from generated config
// Source of truth: src/experiences/{impl}/data/base-config.toml + data/locales/{lang}.toml
// To regenerate: mise run build:config
// To build specific locale: LOCALE=fr mise run build:config

export {
  ANALYTICS,
  APP,
  CHAT_IDS,
  CHAT_TYPES,
  CHATS,
  EXTERNAL_FUNCTIONS,
  GAME,
  GAME_EVENTS,
  I18N,
  MESSAGE_TYPES,
  PHONE,
  START_STATE,
  STRINGS,
  UI,
} from './generated/config.js';

// Seed messages are now in ink files (Phase 2 complete)
// Each chat knot has seed messages in a {knot == 1:} block
