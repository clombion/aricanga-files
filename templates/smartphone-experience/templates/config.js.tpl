// Config - Re-exports from generated config
// Source of truth: experiences/{{name}}/data/base-config.toml + locales
// To regenerate: IMPL={{name}} mise run build:config

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
