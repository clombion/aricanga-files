import { describe, it, expect, beforeEach } from 'vitest';
import { contextRegistry } from '../../framework/src/foundation/services/context-registry.js';
import {
  t,
  getName,
  I18N_EVENTS,
  getChat,
  getChatIds,
  getApp,
  getUITiming,
  getUIDimension,
  getChatType,
  getChatTypes,
  getChats,
  getLocale,
  getUIStrings,
} from '../../framework/src/systems/conversation/services/conversation-context.js';

describe('conversation-context accessors', () => {
  beforeEach(() => {
    contextRegistry.clear();
  });

  describe('when registry is empty (defaults)', () => {
    it('t() returns the key when i18n not registered', () => {
      expect(t('hub.pinned')).toBe('hub.pinned');
    });

    it('t() returns key with vars when i18n not registered', () => {
      expect(t('greeting', { name: 'Pat' })).toBe('greeting');
    });

    it('getName() returns the id when i18n not registered', () => {
      expect(getName('activist')).toBe('activist');
    });

    it('getChat() returns undefined when config not registered', () => {
      expect(getChat('pat')).toBeUndefined();
    });

    it('getChatIds() returns empty array when config not registered', () => {
      expect(getChatIds()).toEqual([]);
    });

    it('getApp() returns empty object when config not registered', () => {
      expect(getApp()).toEqual({});
    });

    it('getUITiming() returns undefined when config not registered', () => {
      expect(getUITiming('focusDelay')).toBeUndefined();
    });

    it('getUIDimension() returns undefined when config not registered', () => {
      expect(getUIDimension('imageMaxWidth')).toBeUndefined();
    });

    it('getChatType() returns undefined when config not registered', () => {
      expect(getChatType('normal')).toBeUndefined();
    });

    it('getChatTypes() returns empty object when config not registered', () => {
      expect(getChatTypes()).toEqual({});
    });

    it('getChats() returns empty object when config not registered', () => {
      expect(getChats()).toEqual({});
    });

    it('getLocale() returns "en" when i18n not registered', () => {
      expect(getLocale()).toBe('en');
    });

    it('getUIStrings() returns empty object when config not registered', () => {
      expect(getUIStrings()).toEqual({});
    });
  });

  describe('when registry has services', () => {
    beforeEach(() => {
      contextRegistry.register('i18n', {
        t: (key: string, vars?: Record<string, string>) => {
          if (key === 'hub.pinned') return 'Pinned';
          if (key === 'greeting' && vars?.name) return `Hello ${vars.name}`;
          return key;
        },
        getName: (id: string, variant: string) => {
          if (id === 'activist' && variant === 'short') return 'Activist';
          return id;
        },
        locale: 'fr',
      });

      contextRegistry.register('config', {
        app: { name: 'TestApp' },
        chatIds: ['pat', 'news'],
        chats: {
          pat: { title: 'Pat', pinned: true },
          news: { title: 'News', pinned: false },
        },
        chatTypes: {
          normal: { canSend: true },
          readonly: { canSend: false },
        },
        ui: {
          timings: { focusDelay: 100, notificationAutoHide: 5000 },
          dimensions: { imageMaxWidth: 250 },
          strings: { resetDialogTitle: 'Reset?' },
        },
      });
    });

    it('t() calls i18n.t with key', () => {
      expect(t('hub.pinned')).toBe('Pinned');
    });

    it('t() calls i18n.t with vars', () => {
      expect(t('greeting', { name: 'Pat' })).toBe('Hello Pat');
    });

    it('getName() calls i18n.getName', () => {
      expect(getName('activist', 'short')).toBe('Activist');
    });

    it('getChat() returns chat config', () => {
      expect(getChat('pat')).toEqual({ title: 'Pat', pinned: true });
    });

    it('getChatIds() returns chat IDs array', () => {
      expect(getChatIds()).toEqual(['pat', 'news']);
    });

    it('getApp() returns app config', () => {
      expect(getApp()).toEqual({ name: 'TestApp' });
    });

    it('getUITiming() returns timing value', () => {
      expect(getUITiming('focusDelay')).toBe(100);
      expect(getUITiming('notificationAutoHide')).toBe(5000);
    });

    it('getUIDimension() returns dimension value', () => {
      expect(getUIDimension('imageMaxWidth')).toBe(250);
    });

    it('getChatType() returns chat type config', () => {
      expect(getChatType('normal')).toEqual({ canSend: true });
      expect(getChatType('readonly')).toEqual({ canSend: false });
    });

    it('getChatTypes() returns all chat types', () => {
      expect(getChatTypes()).toEqual({
        normal: { canSend: true },
        readonly: { canSend: false },
      });
    });

    it('getChats() returns all chats', () => {
      expect(getChats()).toEqual({
        pat: { title: 'Pat', pinned: true },
        news: { title: 'News', pinned: false },
      });
    });

    it('getLocale() returns i18n locale', () => {
      expect(getLocale()).toBe('fr');
    });

    it('getUIStrings() returns UI strings', () => {
      expect(getUIStrings()).toEqual({ resetDialogTitle: 'Reset?' });
    });
  });

  describe('I18N_EVENTS', () => {
    it('exports expected event constants', () => {
      expect(I18N_EVENTS.LOCALE_READY).toBe('locale-ready');
      expect(I18N_EVENTS.LOCALE_CHANGING).toBe('locale-changing');
      expect(I18N_EVENTS.LOCALE_CHANGED).toBe('locale-changed');
    });
  });
});
