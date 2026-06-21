import { createEventBus, createExperience, parseTag } from '@narratives/foundation';
import { cardsSystem } from '@narratives/system-cards';
import { chatSystem } from '@narratives/system-chat';
import { expect, test } from 'vitest';

// task-015 — the design-for-two proof. Lives in an experience because boundary
// lint only permits importing two systems here. Asserts tag-OWNERSHIP routing
// (not foreground fallback): a chat-tagged chunk reaches chat even when cards is
// foreground, and vice versa.

const services = () => ({
  clock: { now: () => 0 },
  store: { load: () => null, save: () => {} },
  analytics: { record: () => {} },
  bus: createEventBus(),
});

const chunk = (rawTags: string[]) => ({
  text: 'x',
  tags: rawTags.map(parseTag),
  choices: [],
  isChoicePoint: false,
});

test('a speaker-tagged chunk routes to chat even when cards is foreground', () => {
  const exp = createExperience({
    systems: [cardsSystem, chatSystem],
    foreground: 'cards',
    services: services(),
  });
  const kinds = exp.dispatch(chunk(['speaker: Pat'])).map((e) => e.kind);
  expect(kinds).toContain('chat/showNotification');
});

test('a stat-tagged chunk routes to cards even when chat is foreground', () => {
  const exp = createExperience({
    systems: [chatSystem, cardsSystem],
    foreground: 'chat',
    services: services(),
  });
  const kinds = exp.dispatch(chunk(['stat: courage:+2'])).map((e) => e.kind);
  expect(kinds).toContain('cards/statChanged');
});

test('createExperience fails loud on empty systems and unknown foreground', () => {
  expect(() => createExperience({ systems: [], services: services() })).toThrow();
  expect(() =>
    createExperience({ systems: [chatSystem], foreground: 'nope', services: services() }),
  ).toThrow();
});
