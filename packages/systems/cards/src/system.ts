import type { Effect, System } from '@narratives/foundation';

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

export type CardsEffect =
  | Effect<'cards/statChanged', { readonly stat: string; readonly delta: number; readonly value: number }>
  | Effect<'cards/cardShown', { readonly cardId: string }>;

// Phase 1 STUB system — applies a `# stat:` tag and advances the deck.
export const cardsSystem: System<CardsState, CardsViewModel> = {
  id: 'cards',
  tags: CARD_TAGS,
  init: () => ({ deckCursor: 0, stats: {}, history: [] }),
  reduce(state, chunk, _ctx) {
    const statTag = chunk.tags.find((t) => t.key === 'stat');
    if (statTag?.value === undefined) return { state, effects: [] };
    // value like "courage:+2"
    const [rawStat, rawDelta] = statTag.value.split(':');
    const stat = rawStat?.trim() ?? 'unknown';
    const delta = Number(rawDelta ?? 0) || 0;
    const value = (state.stats[stat] ?? 0) + delta;
    const effects: CardsEffect[] = [
      { kind: 'cards/statChanged', payload: { stat, delta, value } },
    ];
    return {
      state: {
        deckCursor: state.deckCursor + 1,
        stats: { ...state.stats, [stat]: value },
        history: [...state.history, { cardId: `card-${state.deckCursor}`, delta }],
      },
      effects,
    };
  },
  deriveViewModel: (state) => ({ cursor: state.deckCursor, stats: state.stats }),
  registerComponents() {
    // no-op in Phase 1.
  },
};
