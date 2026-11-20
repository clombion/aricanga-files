import { describe, expect, test } from 'vitest';
import { cardsSystem } from '#src/system';
import { parseTag } from '@narratives/foundation';

/** The seed a deck starts from. */
const SEED = 0;

/** The courage a played card adds. */
const COURAGE = 2;

/**
 * A value as it comes back from saved text: the JSON round trip a save and a load make.
 *
 * @param {unknown} value - The value saved.
 * @returns {unknown} The value read back, untyped.
 */
function throughText(value: unknown): unknown {
  const text = JSON.stringify(value);
  const read: unknown = JSON.parse(text);
  return read;
}

describe('the cards parsers', () => {
  test('refuse every command: the cards system takes none', () => {
    expect.hasAssertions();
    expect(() => cardsSystem.parseCommand({ kind: 'open', payload: { chatId: 'pat' } })).toThrow(
      'system "cards" refuses a command (the cards system takes none): {"kind":"open","payload":{"chatId":"pat"}}',
    );
  });

  test('read a played deck back from saved text as the deck it is', () => {
    expect.hasAssertions();
    const played = cardsSystem.reduce(
      cardsSystem.init(SEED),
      {
        source: 'story',
        step: { choices: [], externalCalls: [], status: 'continue', tags: [parseTag(`stat: courage:+${String(COURAGE)}`)], text: '' },
      },
      { nextId: () => 'id-0' },
    ).state;
    expect(played.stats).toStrictEqual({ courage: COURAGE });
    expect(cardsSystem.parseState(throughText(played))).toStrictEqual(played);
  });

  test('refuse a deck whose stat is not a number, naming the stat', () => {
    expect.hasAssertions();
    expect(() => cardsSystem.parseState({ ...cardsSystem.init(SEED), stats: { courage: 'two' } })).toThrow(
      'system "cards" refuses stats.courage: "two"',
    );
  });
});
