// Conversation Plugin Services - Public API exports

export { BatteryContext, batteryContext } from './battery-context.js';
// Context accessors for decoupled config/i18n access
export {
  getApp,
  getChat,
  getChatIds,
  getChats,
  getChatType,
  getChatTypes,
  getLocale,
  getName,
  getUIDimension,
  getUIStrings,
  getUITiming,
  I18N_EVENTS,
  t,
} from './conversation-context.js';
export { getProfileImage } from './profile-image.js';
