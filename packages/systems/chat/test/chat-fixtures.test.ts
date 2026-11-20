import { describe, expect, test } from 'vitest';
import { chatSystem } from '#src/system';
import { erase } from '@narratives/foundation';
import { inputsOf } from '#test/support';
import { notificationOf } from '#src/effects';
import { readFile } from 'node:fs/promises';
import { runFixture } from '@narratives/foundation/testing';

// Chat ink fixtures driven through the shared harness, proving
// `@narratives/foundation/testing` is consumable from a system's tests. Chat is a
// stub, so its traces are Present-only; real physics traces land in 020–026.

/** The single-chat fixture's two messages. */
const SINGLE_CHAT_MESSAGES = 2;

/**
 * An ink fixture's source.
 *
 * @param {string} name - The fixture's name, without its `.ink` extension.
 * @returns {Promise<string>} The ink source.
 */
async function ink(name: string): Promise<string> {
  const source = await readFile(`packages/systems/chat/test/fixtures/${name}.ink`, 'utf8');
  return source;
}

describe('the chat ink fixtures', () => {
  test('single-chat drives a Present-only trace', async () => {
    expect.hasAssertions();
    const run = await runFixture({ story: await ink('single-chat'), systems: [erase(chatSystem)] });
    expect(run.trace).toHaveLength(SINGLE_CHAT_MESSAGES);
    expect([...new Set(run.effects.map((effect) => effect.family))]).toStrictEqual(['present']);
    expect(run.effects.map((effect) => effect.kind)).toStrictEqual(run.effects.map(() => 'chat/showNotification'));
  });

  test('cross-chat routes a targetChat message', async () => {
    expect.hasAssertions();
    const run = await runFixture({ story: await ink('cross-chat'), systems: [erase(chatSystem)] });
    const chatIds = run.effects.map((effect) => notificationOf(effect)?.chatId);
    expect(chatIds).toContain('main');
    expect(chatIds).toContain('side');
  });

  test('choices captures the pre-choice trace and suspends cleanly', async () => {
    expect.hasAssertions();
    // The chat stub does not handle choices yet (physics, 020–026); the harness
    // must still drive the pre-choice line and return without hanging.
    const run = await runFixture({ story: await ink('choices'), systems: [erase(chatSystem)] });
    expect(inputsOf(run)).toStrictEqual(['Pick a reply']);
  });
});
