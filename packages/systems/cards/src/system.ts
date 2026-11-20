import type { Effect, ReduceResult, System } from '@narratives/foundation';
import { fx, readerOf } from '@narratives/foundation';

const CARD_TAGS = ['card', 'stat'] as const;

/** The cards system's id. */
const CARDS_ID = 'cards';

/** The cards system's readers. */
const READ = readerOf(CARDS_ID);

/** A stat starts at zero, and a delta that is missing or not a number moves nothing. */
const NO_CHANGE = 0;

/** Each card played advances the deck by one. */
const CARDS_PER_PLAY = 1;

// A genuinely different vocabulary from chat — no message/read/deferral concepts.
// The forcing function that keeps foundation honest (ADR-0004/0005).
/** @public */
interface CardsState {
  readonly deckCursor: number;
  readonly stats: Readonly<Record<string, number>>;
  readonly history: readonly { readonly cardId: string; readonly delta: number }[];
}

/** @public */
interface CardsViewModel {
  readonly cursor: number;
  readonly stats: Readonly<Record<string, number>>;
}

/**
 * The delta a `# stat:` tag's value carries, such as `courage:+2`.
 *
 * @param {string | undefined} rawDelta - The text after the colon, if the tag had one.
 * @returns {number} The delta, or no change when the text is missing or not a number.
 */
function deltaOf(rawDelta: string | undefined): number {
  const delta = Number(rawDelta);
  return Number.isNaN(delta) ? NO_CHANGE : delta;
}

/**
 * Apply one `# stat:` tag's value to the deck: the stat moves by its delta and the deck advances.
 *
 * @param {CardsState} state - The deck before the card.
 * @param {string} tagValue - The tag's value, such as `courage:+2`.
 * @returns {ReduceResult<CardsState>} The deck after the card, and the stat change to present.
 */
function applyStat(state: CardsState, tagValue: string): ReduceResult<CardsState> {
  const [rawStat, rawDelta] = tagValue.split(':');
  const stat = rawStat?.trim() ?? 'unknown';
  const delta = deltaOf(rawDelta);
  // A stat is a word the story writes, so only the deck's own entry counts, never Object.prototype's.
  const value = (Object.hasOwn(state.stats, stat) ? (state.stats[stat] ?? NO_CHANGE) : NO_CHANGE) + delta;
  const effects: Effect[] = [fx.present('cards/statChanged', { delta, stat, value })];
  return {
    effects,
    state: {
      deckCursor: state.deckCursor + CARDS_PER_PLAY,
      history: [...state.history, { cardId: `card-${state.deckCursor}`, delta }],
      stats: { ...state.stats, [stat]: value },
    },
  };
}

/**
 * Parse a restored deck.
 *
 * @param {unknown} value - The restored value.
 * @returns {CardsState} The deck; any other value is refused.
 */
function parseCardsState(value: unknown): CardsState {
  const state = READ.object(value, 'a state');
  return {
    deckCursor: READ.number(state['deckCursor'], 'deckCursor'),
    history: READ.list(state['history'], 'history', (entry, at) => {
      const played = READ.object(entry, at);
      return { cardId: READ.string(played['cardId'], `${at}.cardId`), delta: READ.number(played['delta'], `${at}.delta`) };
    }),
    stats: READ.record(state['stats'], 'stats', READ.number),
  };
}

// Phase 1 STUB system — applies a `# stat:` tag and advances the deck. It takes no player command:
// its command union is empty, and every command is refused.
const cardsSystem: System<CardsState, never, Effect, CardsViewModel> = {
  id: CARDS_ID,
  init: () => ({ deckCursor: 0, history: [], stats: {} }),
  parseCommand: (value) => READ.refuse('a command (the cards system takes none)', value),
  parseState: parseCardsState,
  reduce(state, input): ReduceResult<CardsState> {
    if (input.source !== 'story') {
      return { effects: [], state };
    }
    const statTag = input.step.tags.find((tag) => tag.key === 'stat');
    if (statTag?.value === undefined) {
      return { effects: [], state };
    }
    return applyStat(state, statTag.value);
  },
  status: () => 'free',
  tags: [...CARD_TAGS],
  view: (state) => ({ cursor: state.deckCursor, stats: state.stats }),
};

export { CARD_TAGS, cardsSystem };
export type { CardsState, CardsViewModel };
