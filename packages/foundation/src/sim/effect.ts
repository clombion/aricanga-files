import type { DomainEvent } from '../services/event-bus';

// Open, extensible effect channel. Foundation defines the envelope and its own
// kinds; each system contributes its own kinds without foundation referencing them.
export interface Effect<K extends string = string, P = unknown> {
  readonly kind: K;
  readonly payload: P;
}

// Foundation-owned effect kinds (available to every system).
export type FoundationEffect =
  | Effect<'foundation/save', undefined>
  | Effect<'foundation/advanceTime', { readonly minutes: number }>
  | Effect<
      'foundation/requestData',
      { readonly source: string; readonly query: string; readonly params?: string }
    >
  | Effect<'foundation/emit', DomainEvent>;

// Constructors that build optional-field payloads by OMISSION — required under
// exactOptionalPropertyTypes (params?: string does not accept params: undefined).
export const fx = {
  save: (): FoundationEffect => ({ kind: 'foundation/save', payload: undefined }),
  advanceTime: (minutes: number): FoundationEffect => ({
    kind: 'foundation/advanceTime',
    payload: { minutes },
  }),
  requestData: (source: string, query: string, params?: string): FoundationEffect => ({
    kind: 'foundation/requestData',
    payload: params === undefined ? { source, query } : { source, query, params },
  }),
  emit: (event: DomainEvent): FoundationEffect => ({ kind: 'foundation/emit', payload: event }),
} as const;
