// The design-for-two proof, driven through the generic runtime.
// Lives in an experience because boundary lint only permits importing two systems
// here. Asserts tag-OWNERSHIP routing (not foreground fallback): a chat-tagged
// step reaches chat even when cards is foreground, and a stat-tagged step reaches
// cards even when chat is foreground.

import type { Effect, Host } from '@narratives/foundation';
import { InkRuntime, createExperience, erase } from '@narratives/foundation';
import { compileInk, heldScheduler, memoryStore } from '@narratives/foundation/testing';
import { describe, expect, test } from 'vitest';
import { cardsSystem } from '@narratives/system-cards';
import { chatSystem } from '@narratives/system-chat';

/** What each step the story takes adds to the count. */
const ONE_STEP = 1;

/** A host and the kinds of the effects it was handed to present. */
interface RecordingHost {
  readonly host: Host;
  readonly presented: readonly string[];
}

/**
 * A deterministic host that records every effect it presents: a timer it is handed is held and
 * never fires, so a run is the same on every machine, and a save is kept in memory.
 * @returns {RecordingHost} The host and what it presented.
 */
function recordingHost(): RecordingHost {
  const presented: string[] = [];
  const timers = new Set<() => void>();
  const host: Host = {
    // These stories fetch nothing: a data request fails the test, naming the request.
    fetchData: (request) => {
      throw new Error(`these stories fetch nothing, and requested ${JSON.stringify(request)}`);
    },
    present: (effect: Effect) => {
      presented.push(effect.kind);
    },
    scheduler: heldScheduler((fire) => {
      timers.add(fire);
    }),
    store: memoryStore(),
  };
  return { host, presented };
}

/**
 * A runtime over a one-line story.
 * @returns {InkRuntime} The runtime.
 */
function ink(): InkRuntime {
  return InkRuntime.fromJson(compileInk('x\n'));
}

/**
 * Pump the whole story.
 * @param {object} experience The experience to step.
 * @returns {number} How many steps advanced it.
 */
function drain(experience: Readonly<{ step: () => boolean }>): number {
  let steps = 0;
  while (experience.step()) {
    steps += ONE_STEP;
  }
  return steps;
}

describe('routing by tag ownership', () => {
  test('a speaker-tagged step routes to chat even when cards is foreground', () => {
    expect.hasAssertions();
    const { host, presented } = recordingHost();
    const experience = createExperience({
      foreground: 'cards',
      host,
      ink: InkRuntime.fromJson(compileInk('Hello # speaker: Pat\n')),
      systems: [erase(cardsSystem), erase(chatSystem)],
    });
    drain(experience);
    expect(presented).toContain('chat/showNotification');
  });

  test('a stat-tagged step routes to cards even when chat is foreground', () => {
    expect.hasAssertions();
    const { host, presented } = recordingHost();
    const experience = createExperience({
      foreground: 'chat',
      host,
      ink: InkRuntime.fromJson(compileInk('Courage up # stat: courage:+2\n')),
      systems: [erase(chatSystem), erase(cardsSystem)],
    });
    drain(experience);
    expect(presented).toContain('cards/statChanged');
  });

  test('createExperience fails loud on empty systems and unknown foreground', () => {
    expect.hasAssertions();
    const { host } = recordingHost();
    expect(() => createExperience({ host, ink: ink(), systems: [] })).toThrow('at least one system');
    expect(() => createExperience({ foreground: 'nope', host, ink: ink(), systems: [erase(chatSystem)] })).toThrow(
      'foreground system "nope" is not registered',
    );
  });
});
