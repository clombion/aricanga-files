/**
 * Unit tests for foundation event-factories.js
 *
 * Tests the event payload factories and validation helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  required,
  createTimeEvent,
  createDataRequestEvent,
  createDataResponseEvent,
  createDataErrorEvent,
  createLocaleReadyEvent,
  createLocaleChangingEvent,
  createLocaleChangedEvent,
  createMessageReceivedEvent,
  createBatteryChangedEvent,
} from '../../framework/src/foundation/services/event-factories.js';

describe('required', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('returns value unchanged when defined', () => {
    expect(required('test', 'field')).toBe('test');
    expect(required(0, 'field')).toBe(0);
    expect(required(false, 'field')).toBe(false);
    expect(required('', 'field')).toBe('');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('logs error for null value', () => {
    const result = required(null, 'myField');
    expect(result).toBe(null);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Event factory: missing required field "myField"'
    );
  });

  it('logs error for undefined value', () => {
    const result = required(undefined, 'myField');
    expect(result).toBe(undefined);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Event factory: missing required field "myField"'
    );
  });
});

describe('createTimeEvent', () => {
  it('creates time event with required fields', () => {
    const result = createTimeEvent('9:23 AM', 3);
    expect(result).toEqual({ time: '9:23 AM', day: 3 });
  });

  it('handles day 0', () => {
    const result = createTimeEvent('12:00 PM', 0);
    expect(result).toEqual({ time: '12:00 PM', day: 0 });
  });
});

describe('createDataRequestEvent', () => {
  it('creates data request with required fields', () => {
    const result = createDataRequestEvent('req-123', 'glossary', 'lookup', {});
    expect(result).toEqual({
      requestId: 'req-123',
      source: 'glossary',
      query: 'lookup',
      params: {},
    });
  });

  it('includes params when provided', () => {
    const result = createDataRequestEvent('req-456', 'news', 'article', {
      id: 'article-1',
    });
    expect(result.params).toEqual({ id: 'article-1' });
  });

  it('defaults params to empty object', () => {
    const result = createDataRequestEvent('req-789', 'source', 'query');
    expect(result.params).toEqual({});
  });
});

describe('createDataResponseEvent', () => {
  it('creates data response with all fields', () => {
    const result = createDataResponseEvent(
      'req-123',
      'glossary',
      'lookup',
      { term: 'test' },
      { definition: 'A trial' }
    );
    expect(result).toEqual({
      requestId: 'req-123',
      source: 'glossary',
      query: 'lookup',
      params: { term: 'test' },
      data: { definition: 'A trial' },
    });
  });
});

describe('createDataErrorEvent', () => {
  it('creates data error with error message', () => {
    const result = createDataErrorEvent(
      'req-123',
      'glossary',
      'lookup',
      { term: 'test' },
      'Not found'
    );
    expect(result).toEqual({
      requestId: 'req-123',
      source: 'glossary',
      query: 'lookup',
      params: { term: 'test' },
      error: 'Not found',
    });
  });

  it('creates data error with Error object', () => {
    const error = new Error('Network failure');
    const result = createDataErrorEvent(
      'req-456',
      'api',
      'fetch',
      {},
      error
    );
    expect(result.error).toBe(error);
  });
});

describe('createLocaleReadyEvent', () => {
  it('creates locale ready event', () => {
    const result = createLocaleReadyEvent('en');
    expect(result).toEqual({ locale: 'en' });
  });
});

describe('createLocaleChangingEvent', () => {
  it('creates locale changing event', () => {
    const result = createLocaleChangingEvent('en', 'fr');
    expect(result).toEqual({ from: 'en', to: 'fr' });
  });
});

describe('createLocaleChangedEvent', () => {
  it('creates locale changed event', () => {
    const result = createLocaleChangedEvent('en', 'fr');
    expect(result).toEqual({ from: 'en', to: 'fr' });
  });
});

describe('createMessageReceivedEvent', () => {
  it('creates message received event', () => {
    const message = { text: 'Hello', speaker: 'Pat' };
    const result = createMessageReceivedEvent('pat_chat', message);
    expect(result).toEqual({
      chatId: 'pat_chat',
      message: { text: 'Hello', speaker: 'Pat' },
    });
  });
});

describe('createBatteryChangedEvent', () => {
  it('creates battery changed event', () => {
    const result = createBatteryChangedEvent(85, false);
    expect(result).toEqual({ battery: 85, isLow: false });
  });

  it('handles low battery state', () => {
    const result = createBatteryChangedEvent(10, true);
    expect(result).toEqual({ battery: 10, isLow: true });
  });
});
