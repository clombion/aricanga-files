import { describe, it, expect, beforeEach } from 'vitest';
import { contextRegistry } from '../../framework/src/foundation/services/context-registry.js';

describe('contextRegistry', () => {
  beforeEach(() => {
    contextRegistry.clear();
  });

  describe('register/get', () => {
    it('registers and retrieves a service', () => {
      const service = { foo: 'bar' };
      contextRegistry.register('myService', service);

      expect(contextRegistry.get('myService')).toBe(service);
    });

    it('returns undefined for unregistered service', () => {
      expect(contextRegistry.get('nonexistent')).toBeUndefined();
    });

    it('overwrites existing service on re-register', () => {
      const service1 = { version: 1 };
      const service2 = { version: 2 };

      contextRegistry.register('service', service1);
      contextRegistry.register('service', service2);

      expect(contextRegistry.get('service')).toBe(service2);
    });

    it('supports multiple services', () => {
      contextRegistry.register('i18n', { t: () => 'translated' });
      contextRegistry.register('config', { app: { name: 'Test' } });

      expect(contextRegistry.get('i18n')).toEqual({ t: expect.any(Function) });
      expect(contextRegistry.get('config')).toEqual({ app: { name: 'Test' } });
    });
  });

  describe('clear', () => {
    it('removes all registered services', () => {
      contextRegistry.register('a', 1);
      contextRegistry.register('b', 2);

      contextRegistry.clear();

      expect(contextRegistry.get('a')).toBeUndefined();
      expect(contextRegistry.get('b')).toBeUndefined();
    });
  });
});
