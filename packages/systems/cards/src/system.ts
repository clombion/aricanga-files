import {
  type Command,
  type Effect,
  type ReduceResult,
  type System,
  fx,
} from '@narratives/foundation';

export const CARD_TAGS = ['card', 'stat'] as const;

// A genuinely different vocabulary from chat — no message/read/deferral concepts.
// The forcing function that keeps foundation honest (ADR-0004/0005).
export interface CardsState {
  readonly deckCursor: number;
  readonly stats: Readonly<Record<string, number>>;
  readonly history: readonly { readonly cardId: string; readonly delta: number }[];
}

export interface CardsViewModel {
  readonly cursor: number;
  readonly stats: Readonly<Record<string, number>>;
}

// Phase 1 STUB system — applies a `# stat:` tag and advances the deck.
export const cardsSystem: System<CardsState, Command, Effect, CardsViewModel> = {
  id: 'cards',
  tags: [...CARD_TAGS],
  init: (_seed) => ({ deckCursor: 0, stats: {}, history: [] }),
  reduce(state, input, _ctx): ReduceResult<CardsState, Effect> {
    if (input.source !== 'story') return { state, effects: [] };
    const statTag = input.step.tags.find((t) => t.key === 'stat');
    if (statTag?.value === undefined) return { state, effects: [] };
    // value like "courage:+2"
    const [rawStat, rawDelta] = statTag.value.split(':');
    const stat = rawStat?.trim() ?? 'unknown';
    const delta = Number(rawDelta ?? 0) || 0;
    const value = (state.stats[stat] ?? 0) + delta;
    const effects: Effect[] = [fx.present('cards/statChanged', { stat, delta, value })];
    return {
      state: {
        deckCursor: state.deckCursor + 1,
        stats: { ...state.stats, [stat]: value },
        history: [...state.history, { cardId: `card-${state.deckCursor}`, delta }],
      },
      effects,
    };
  },
  status: () => 'free',
  view: (state) => ({ cursor: state.deckCursor, stats: state.stats }),
};
