import { describe, test } from 'vitest';
import type { CardsState } from '#src/system';
import { cardsSystem } from '#src/system';
import { parseTag } from '@narratives/foundation';

/** The seed a deck starts from. */
const SEED = 0;

/** The context a view renders with. */
const RENDER = { locale: 'en', now: 0 };

/** The deck's cursor after two cards. */
const TWO_CARDS = 2;

/** A stat no card has moved. */
const NO_MOVE = 0;

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
  test('starts from zero whatever its name, Object.prototype members included', ({ expect }) => {
    expect.hasAssertions();
    const played = play(play(cardsSystem.init(SEED), `toString:+${String(COURAGE)}`), `constructor:+${String(COURAGE)}`);
    expect(played.stats).toStrictEqual({ constructor: COURAGE, toString: COURAGE });
  });

  test('adds each card to the stat it names', ({ expect }) => {
    expect.hasAssertions();
    const played = play(play(cardsSystem.init(SEED), `courage:+${String(COURAGE)}`), `courage:+${String(COURAGE)}`);
    expect(cardsSystem.view(played, RENDER)).toStrictEqual({ cursor: TWO_CARDS, stats: { courage: COURAGE + COURAGE } });
  });

  test('moves nothing for a delta that is missing or not a number, yet still plays the card', ({ expect }) => {
    expect.hasAssertions();
    const played = play(play(cardsSystem.init(SEED), 'courage'), 'courage:lots');
    expect(cardsSystem.view(played, RENDER)).toStrictEqual({ cursor: TWO_CARDS, stats: { courage: NO_MOVE } });
  });
});

describe('the cards system', () => {
  test('ignores a stat tag with no value, a step without one, and any input that is no story step', ({ expect }) => {
    expect.hasAssertions();
    const deck = cardsSystem.init(SEED);
    const step = (tags: readonly string[]): CardsState =>
      cardsSystem.reduce(
        deck,
        { source: 'story', step: { choices: [], externalCalls: [], status: 'continue', tags: tags.map((raw) => parseTag(raw)), text: '' } },
        { nextId: () => 'id-0' },
      ).state;
    expect(step(['stat'])).toStrictEqual(deck);
    expect(step(['speaker: Pat'])).toStrictEqual(deck);
    expect(cardsSystem.reduce(deck, { lifecycle: { kind: 'reset' }, source: 'lifecycle' }, { nextId: () => 'id-0' }).state).toStrictEqual(
      deck,
    );
  });
});
