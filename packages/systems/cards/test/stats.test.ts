import { describe, expect, test } from 'vitest';
import type { CardsState } from '#src/system';
import { cardsSystem } from '#src/system';
import { parseTag } from '@narratives/foundation';

/** The seed a deck starts from. */
const SEED = 0;

/** The courage a played card adds. */
const COURAGE = 2;

/**
 * A deck after one card that moves a stat.
 *
 * @param {CardsState} state - The deck before the card.
 * @param {string} tagValue - The `# stat:` tag's value.
 * @returns {CardsState} The deck after it.
 */
function play(state: CardsState, tagValue: string): CardsState {
  return cardsSystem.reduce(
    state,
    { source: 'story', step: { choices: [], externalCalls: [], status: 'continue', tags: [parseTag(`stat: ${tagValue}`)], text: '' } },
    { nextId: () => 'id-0' },
  ).state;
}

describe('a stat a card moves', () => {
  test('starts from zero whatever its name, Object.prototype members included', () => {
    expect.hasAssertions();
    const played = play(play(cardsSystem.init(SEED), `toString:+${String(COURAGE)}`), `constructor:+${String(COURAGE)}`);
    expect(played.stats).toStrictEqual({ constructor: COURAGE, toString: COURAGE });
  });
});
