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

/** A host-family payload that does not have its family's shape. */
export class EffectPayloadError extends Error {
  override readonly name = 'EffectPayloadError';
}

/** Whether a payload is an object carrying the named field. */
export function hasField(payload: unknown, name: string): boolean {
  return typeof payload === 'object' && payload !== null && name in payload;
}

/** A payload's named field; a payload without it is refused. */
export function field(payload: unknown, name: string): unknown {
  if (!hasField(payload, name)) {
    throw new EffectPayloadError(`effect payload has no ${name}: ${JSON.stringify(payload)}`);
  }
  return Object.getOwnPropertyDescriptor(payload, name)?.value;
}

/** A payload's named string field. */
export function text(payload: unknown, name: string): string {
  const value = field(payload, name);
  if (typeof value !== 'string') throw new EffectPayloadError(`effect payload ${name} is not a string`);
  return value;
}

function count(payload: unknown, name: string): number {
  const value = field(payload, name);
  if (typeof value !== 'number') throw new EffectPayloadError(`effect payload ${name} is not a number`);
  return value;
}

/** Parse a `drive-ink` payload. The host's families have fixed payloads; the executor parses, never casts. */
export function parseDriveInkOp(payload: unknown): DriveInkOp {
  const op = text(payload, 'op');
  switch (op) {
    case 'choose':
      return { op, index: count(payload, 'index') };
    case 'goto':
      return { op, knot: text(payload, 'knot') };
    case 'save-snap':
    case 'load-snap':
      return { op, id: text(payload, 'id') };
    default:
      throw new EffectPayloadError(`unknown drive-ink op ${op}`);
  }
}

/** Parse a `schedule` payload. */
export function parseScheduleCommit(payload: unknown): ScheduleCommit {
  return { delayMs: count(payload, 'delayMs'), token: count(payload, 'token') };
}

/** Parse a `fetch` payload. */
export function parseDataRequest(payload: unknown): DataRequest {
  const request = { source: text(payload, 'source'), query: text(payload, 'query') };
  return hasField(payload, 'params')
    ? { ...request, params: text(payload, 'params') }
    : request;
}
