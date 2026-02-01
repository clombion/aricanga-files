/**
 * System Integrity Tests - Conversation System
 *
 * These tests verify that the conversation system is truly isolated from
 * game implementations. They run as unit tests with direct imports.
 *
 * IMPORTANT: This file must NOT import anything from experiences/
 * If you need to import from there, you're testing the wrong thing.
 */
import { describe, it, expect } from 'vitest';
import { conversationSystem } from '../../framework/src/systems/conversation/conversation-system.js';
import { createSystemContext } from '../../framework/src/foundation/core/foundation.js';

describe('Conversation System Isolation', () => {
  it('system has correct shape (System interface)', () => {
    expect(conversationSystem.id).toBe('conversation');
    expect(Array.isArray(conversationSystem.tagHandlers)).toBe(true);
    expect(conversationSystem.tagHandlers.length).toBeGreaterThan(0);
    expect(typeof conversationSystem.createExternalFunctions).toBe('function');
    expect(typeof conversationSystem.init).toBe('function');
  });

  it('system has expected tag handlers', () => {
    const tagNames = conversationSystem.tagHandlers.map(
      (h: { tag: string }) => h.tag
    );

    expect(tagNames).toContain('speaker');
    expect(tagNames).toContain('type');
    expect(tagNames).toContain('delay');
  });

  it('system creates expected external functions', () => {
    const context = createSystemContext({
      foundation: { runtime: {} },
      eventBus: { emit: () => {}, on: () => () => {} },
      timeContext: { now: () => Date.now() },
    });

    const functions = conversationSystem.createExternalFunctions(context);
    const functionNames = functions.map((f: { name: string }) => f.name);

    expect(functionNames).toContain('delay_next');
    expect(functionNames).toContain('play_sound');
    expect(functionNames).toContain('advance_day');
    expect(functionNames).toContain('name');
    expect(functionNames).toContain('request_data');
  });

  it('delay_next function sets captured delay', () => {
    const fakeRuntime = {
      capturedDelay: 0,
      setCapturedDelay(ms: number) {
        this.capturedDelay = ms;
      },
    };

    const context = createSystemContext({
      foundation: { runtime: fakeRuntime },
      eventBus: { emit: () => {}, on: () => () => {} },
      timeContext: { now: () => Date.now() },
    });

    const functions = conversationSystem.createExternalFunctions(context);
    const delayNext = functions.find(
      (f: { name: string }) => f.name === 'delay_next'
    );

    delayNext.fn(1500);
    expect(fakeRuntime.capturedDelay).toBe(1500);
  });

  it('request_data emits event via eventBus', () => {
    const fakeRuntime = { awaitingData: false };
    const emittedEvents: Array<{ type: string; detail: unknown }> = [];
    const fakeEventBus = {
      emit(type: string, detail: unknown) {
        emittedEvents.push({ type, detail });
      },
      on: () => () => {},
    };

    const context = createSystemContext({
      foundation: { runtime: fakeRuntime },
      eventBus: fakeEventBus,
      timeContext: { now: () => Date.now() },
    });

    const functions = conversationSystem.createExternalFunctions(context);
    const requestData = functions.find(
      (f: { name: string }) => f.name === 'request_data'
    );

    requestData.fn('eiti', 'beneficial_owners', 'aricanga');

    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0].type).toBe('data:requested');
    expect(fakeRuntime.awaitingData).toBe(true);
  });
});
