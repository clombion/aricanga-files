import { readFileSync } from 'node:fs';
import { erase } from '@narratives/foundation';
import { runFixture } from '@narratives/foundation/testing';
import { expect, test } from 'vitest';
import { chatSystem } from '../src/system';

// task-017 #5/#7 — chat ink fixtures driven through the shared harness, proving
// `@narratives/foundation/testing` is consumable from a system's tests. Chat is a
// stub, so its traces are Present-only; real physics traces land in 020–026.

const ink = (name: string): string =>
  readFileSync(`packages/systems/chat/test/fixtures/${name}.ink`, 'utf8');

test('single-chat fixture drives a Present-only trace', async () => {
  const run = await runFixture({ story: ink('single-chat'), systems: [erase(chatSystem)] });
  expect(run.trace.length).toBe(2); // two messages
  expect(new Set(run.effects.map((e) => e.family))).toEqual(new Set(['present']));
  expect(run.effects.every((e) => e.kind === 'chat/showNotification')).toBe(true);
});

test('cross-chat fixture routes a targetChat message', async () => {
  const run = await runFixture({ story: ink('cross-chat'), systems: [erase(chatSystem)] });
  const chatIds = run.effects.map((e) => (e.payload as { chatId: string }).chatId);
  expect(chatIds).toContain('main');
  expect(chatIds).toContain('side');
});

test('choices fixture captures the pre-choice trace and suspends cleanly', async () => {
  // The chat stub does not handle choices yet (physics, 020–026); the harness
  // must still drive the pre-choice line and return without hanging.
  const run = await runFixture({ story: ink('choices'), systems: [erase(chatSystem)] });
  expect(run.trace.length).toBe(1);
  expect((run.trace[0]?.input as { step: { text: string } }).step.text).toBe('Pick a reply');
});
