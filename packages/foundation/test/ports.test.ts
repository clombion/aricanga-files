import { describe, expect, test } from 'vitest';
import { heldScheduler, memoryStore } from '@narratives/foundation/testing';
import type { DomainEvent } from '#src/services/event-bus';
import { createEventBus } from '@narratives/foundation';

/** The delay a held timer is scheduled with; a held scheduler ignores it. */
const DELAY_MS = 10;

describe('the event bus', () => {
  test('delivers an event to the handlers of its type only, and to none after they unsubscribe', () => {
    expect.hasAssertions();
    const bus = createEventBus();
    const heard: string[] = [];
    const unsubscribe = bus.on('tick', (event) => {
      heard.push(`a:${event.type}`);
    });
    bus.on('tock', (event) => {
      heard.push(`b:${event.type}`);
    });
    bus.emit({ type: 'tick' });
    unsubscribe();
    bus.emit({ type: 'tick' });
    bus.emit({ type: 'tock' });
    expect(heard).toStrictEqual(['a:tick', 'b:tock']);
  });

  test('drops an event no handler subscribed to', () => {
    expect.hasAssertions();
    const bus = createEventBus();
    const heard: DomainEvent[] = [];
    bus.on('tick', (event) => {
      heard.push(event);
    });
    bus.emit({ type: 'nobody' });
    expect(heard).toStrictEqual([]);
  });

  test('delivers to every handler of the event even when one unsubscribes another during delivery', () => {
    expect.hasAssertions();
    const bus = createEventBus();
    const heard: string[] = [];
    const later: { unsubscribe?: () => void } = {};
    bus.on('tick', () => {
      heard.push('first');
      later.unsubscribe?.();
    });
    later.unsubscribe = bus.on('tick', () => {
      heard.push('second');
    });
    bus.emit({ type: 'tick' });
    bus.emit({ type: 'tick' });
    expect(heard).toStrictEqual(['first', 'second', 'first']);
  });
});

describe('the deterministic host ports', () => {
  test('a held scheduler hands each timer to the test, and cancelling one leaves it with the test', () => {
    expect.hasAssertions();
    const held: (() => void)[] = [];
    const fired: string[] = [];
    const cancel = heldScheduler((fire) => {
      held.push(fire);
    }).schedule(DELAY_MS, () => {
      fired.push('fired');
    });
    cancel();
    expect(fired).toStrictEqual([]);
    for (const fire of held) {
      fire();
    }
    expect(fired).toStrictEqual(['fired']);
  });

  test('a memory store loads nothing until saved, then the last save', () => {
    expect.hasAssertions();
    const store = memoryStore();
    expect(store.load()).toBeUndefined();
    store.save('one');
    store.save('two');
    expect(store.load()).toBe('two');
  });
});
