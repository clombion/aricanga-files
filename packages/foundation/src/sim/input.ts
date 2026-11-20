import type { CommitToken, DataRequest } from './effect';
import type { InkStep } from './story';

/*
 * An inbound, system-addressed command — the open envelope mirroring `Effect`
 * but flowing in. The target (e.g. a chat id) lives in the payload, never in a
 * routing key.
 */
interface Command<TKind extends string = string, TPayload = unknown> {
  readonly kind: TKind;
  readonly payload: TPayload;
}

/**
 * Completion of a suspending effect — one constructor per suspending family
 * (ADR-0007): the handshake table is total.
 *
 * @public
 */
type Resume<TState> =
  | { readonly kind: 'commit-fired'; readonly token: CommitToken }
  | { readonly kind: 'data-arrived'; readonly request: DataRequest; readonly value: unknown }
  | { readonly kind: 'story-loaded' }
  | { readonly kind: 'restored'; readonly state: TState };

/** @public */
type Lifecycle = { readonly kind: 'init'; readonly seed: number } | { readonly kind: 'reset' };

/*
 * The closed Input algebra — every value that can drive `reduce`, closed by
 * source (ADR-0007). The four sources are full at the contract; a system grows
 * only its `Command` kinds, never the source set.
 */
type Input<TState, TCommand extends Command = Command> =
  | { readonly source: 'story'; readonly step: InkStep }
  | { readonly source: 'player'; readonly command: TCommand }
  | { readonly source: 'resume'; readonly resume: Resume<TState> }
  | { readonly source: 'lifecycle'; readonly lifecycle: Lifecycle };

export type { Command, Input, Lifecycle, Resume };
