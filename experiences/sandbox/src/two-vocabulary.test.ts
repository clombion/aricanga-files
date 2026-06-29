import { type Effect, type Host, InkRuntime, createExperience, erase } from '@narratives/foundation';
import { Compiler } from 'inkjs/full';
import { cardsSystem } from '@narratives/system-cards';
import { chatSystem } from '@narratives/system-chat';
import { expect, test } from 'vitest';

// task-015 — the design-for-two proof, now driven through the generic runtime.
// Lives in an experience because boundary lint only permits importing two systems
// here. Asserts tag-OWNERSHIP routing (not foreground fallback): a chat-tagged
// step reaches chat even when cards is foreground, and a stat-tagged step reaches
// cards even when chat is foreground.

function compile(src: string): string {
  return new Compiler(src).Compile().ToJson() ?? '';
}

function recordingHost(): { host: Host; presented: string[] } {
  const presented: string[] = [];
  const host: Host = {
    scheduler: { schedule: () => () => {} },
    store: { load: () => null, save: () => {} },
    fetchData: () => Promise.resolve(null),
    present: (effect: Effect) => {
      presented.push(effect.kind);
    },
  };
  return { host, presented };
}

function drain(exp: { step(): boolean }): void {
  while (exp.step()) {
    /* pump the whole story */
  }
}

test('a speaker-tagged step routes to chat even when cards is foreground', () => {
  const { host, presented } = recordingHost();
  const exp = createExperience({
    ink: new InkRuntime(compile('Hello # speaker: Pat\n')),
    systems: [erase(cardsSystem), erase(chatSystem)],
    foreground: 'cards',
    host,
  });
  drain(exp);
  expect(presented).toContain('chat/showNotification');
});

test('a stat-tagged step routes to cards even when chat is foreground', () => {
  const { host, presented } = recordingHost();
  const exp = createExperience({
    ink: new InkRuntime(compile('Courage up # stat: courage:+2\n')),
    systems: [erase(chatSystem), erase(cardsSystem)],
    foreground: 'chat',
    host,
  });
  drain(exp);
  expect(presented).toContain('cards/statChanged');
});

test('createExperience fails loud on empty systems and unknown foreground', () => {
  const { host } = recordingHost();
  const ink = () => new InkRuntime(compile('x\n'));
  expect(() => createExperience({ ink: ink(), systems: [], host })).toThrow();
  expect(() =>
    createExperience({ ink: ink(), systems: [erase(chatSystem)], foreground: 'nope', host }),
  ).toThrow();
});
