// The Effect algebra — closed by host capability (ADR-0007). Each family is the
// foundation envelope `{ family, kind, payload }`: the FAMILY set is closed (a
// reducer handles it exhaustively), while the `kind` within a family stays open
// and is dispatched by the executor (`kind -> handler`). A system specialises the
// families it uses; it never adds a family.

export type EffectFamily = 'drive-ink' | 'schedule' | 'fetch' | 'present' | 'persist';

export interface Effect<F extends EffectFamily = EffectFamily, K extends string = string, P = unknown> {
  readonly family: F;
  readonly kind: K;
  readonly payload: P;
}

// A commit token is a kernel-state epoch: a scheduled commit fires a matching
// `Resume(CommitFired token)`; a token the state has moved past is stale.
export type CommitToken = number;

export interface ScheduleCommit {
  readonly delayMs: number;
  readonly token: CommitToken;
}

// An async external-data request; correlated back by `Resume(DataArrived request)`.
export interface DataRequest {
  readonly source: string;
  readonly query: string;
  readonly params?: string;
}

// The instruction the host carries out against its own ink Story.
export type DriveInkOp =
  | { readonly op: 'choose'; readonly index: number }
  | { readonly op: 'goto'; readonly knot: string }
  | { readonly op: 'save-snap'; readonly id: string }
  | { readonly op: 'load-snap'; readonly id: string };

// Foundation constructors for the host-generic families. `present` is
// system-specific (a system supplies its own kind + payload).
export const fx = {
  driveInk: (op: DriveInkOp): Effect<'drive-ink', DriveInkOp['op'], DriveInkOp> => ({
    family: 'drive-ink',
    kind: op.op,
    payload: op,
  }),
  schedule: (commit: ScheduleCommit): Effect<'schedule', 'commit', ScheduleCommit> => ({
    family: 'schedule',
    kind: 'commit',
    payload: commit,
  }),
  fetch: (request: DataRequest): Effect<'fetch', 'request-data', DataRequest> => ({
    family: 'fetch',
    kind: 'request-data',
    payload: request,
  }),
  persist: (): Effect<'persist', 'save', undefined> => ({
    family: 'persist',
    kind: 'save',
    payload: undefined,
  }),
  present: <K extends string, P>(kind: K, payload: P): Effect<'present', K, P> => ({
    family: 'present',
    kind,
    payload,
  }),
} as const;
