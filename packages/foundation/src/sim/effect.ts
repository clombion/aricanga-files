/*
 * The Effect algebra — closed by host capability (ADR-0007). Each family is the
 * foundation envelope `{ family, kind, payload }`: the FAMILY set is closed (a
 * reducer handles it exhaustively), while the `kind` within a family stays open
 * and is dispatched by the executor (`kind -> handler`). A system specialises the
 * families it uses; it never adds a family.
 */

/** @public */
type EffectFamily = 'drive-ink' | 'schedule' | 'fetch' | 'present' | 'persist';

/** An effect: its family, the kind within the family, and the kind's payload. */
interface Effect<TFamily extends EffectFamily = EffectFamily, TKind extends string = string, TPayload = unknown> {
  readonly family: TFamily;
  readonly kind: TKind;
  readonly payload: TPayload;
}

/*
 * A commit token is a kernel-state epoch: a scheduled commit fires a matching
 * `Resume(CommitFired token)`; a token the state has moved past is stale.
 */
type CommitToken = number;

/** @public */
interface ScheduleCommit {
  readonly delayMs: number;
  readonly token: CommitToken;
}

/** An async external-data request; correlated back by `Resume(DataArrived request)`. */
interface DataRequest {
  readonly source: string;
  readonly query: string;
  readonly params?: string;
}

/** The instruction the host carries out against its own ink Story. */
type DriveInkOp =
  | { readonly op: 'choose'; readonly index: number }
  | { readonly op: 'goto'; readonly knot: string }
  | { readonly op: 'save-snap'; readonly id: string }
  | { readonly op: 'load-snap'; readonly id: string };

/*
 * Foundation constructors for the host-generic families. `present` is
 * system-specific (a system supplies its own kind + payload).
 */
const fx = {
  driveInk: (op: DriveInkOp): Effect<'drive-ink', DriveInkOp['op'], DriveInkOp> => ({
    family: 'drive-ink',
    kind: op.op,
    payload: op,
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
  present: <TKind extends string, TPayload>(kind: TKind, payload: TPayload): Effect<'present', TKind, TPayload> => ({
    family: 'present',
    kind,
    payload,
  }),
  schedule: (commit: ScheduleCommit): Effect<'schedule', 'commit', ScheduleCommit> => ({
    family: 'schedule',
    kind: 'commit',
    payload: commit,
  }),
} as const;

/** A host-family payload that does not have its family's shape. */
class EffectPayloadError extends Error {
  public override readonly name = 'EffectPayloadError';
}

/**
 * Whether a payload is an object carrying the named field.
 *
 * @param {unknown} payload - The payload to inspect.
 * @param {string} name - The field's name.
 * @returns {boolean} Whether the payload is an object with that field.
 */
function hasField(payload: unknown, name: string): boolean {
  return typeof payload === 'object' && payload !== null && name in payload;
}

/**
 * A payload's named field; a payload without it is refused.
 *
 * @param {unknown} payload - The payload to read.
 * @param {string} name - The field's name.
 * @returns {unknown} The field's value.
 */
function field(payload: unknown, name: string): unknown {
  if (!hasField(payload, name)) {
    throw new EffectPayloadError(`effect payload has no ${name}: ${JSON.stringify(payload)}`);
  }
  return Object.getOwnPropertyDescriptor(payload, name)?.value;
}

/**
 * A payload's named string field.
 *
 * @param {unknown} payload - The payload to read.
 * @param {string} name - The field's name.
 * @returns {string} The field's string value.
 */
function text(payload: unknown, name: string): string {
  const value = field(payload, name);
  if (typeof value !== 'string') {
    throw new EffectPayloadError(`effect payload ${name} is not a string`);
  }
  return value;
}

/**
 * A payload's named number field.
 *
 * @param {unknown} payload - The payload to read.
 * @param {string} name - The field's name.
 * @returns {number} The field's number value.
 */
function count(payload: unknown, name: string): number {
  const value = field(payload, name);
  if (typeof value !== 'number') {
    throw new EffectPayloadError(`effect payload ${name} is not a number`);
  }
  return value;
}

/**
 * Parse a `drive-ink` payload. The host's families have fixed payloads; the executor parses, never casts.
 *
 * @param {unknown} payload - A `drive-ink` effect's payload.
 * @returns {DriveInkOp} The instruction it carries.
 */
function parseDriveInkOp(payload: unknown): DriveInkOp {
  const op = text(payload, 'op');
  switch (op) {
    case 'choose': {
      return { index: count(payload, 'index'), op };
    }
    case 'goto': {
      return { knot: text(payload, 'knot'), op };
    }
    case 'save-snap':
    case 'load-snap': {
      return { id: text(payload, 'id'), op };
    }
    default: {
      throw new EffectPayloadError(`unknown drive-ink op ${op}`);
    }
  }
}

/**
 * Parse a `schedule` payload.
 *
 * @param {unknown} payload - A `schedule` effect's payload.
 * @returns {ScheduleCommit} The commit it schedules.
 */
function parseScheduleCommit(payload: unknown): ScheduleCommit {
  return { delayMs: count(payload, 'delayMs'), token: count(payload, 'token') };
}

/**
 * Parse a `fetch` payload.
 *
 * @param {unknown} payload - A `fetch` effect's payload.
 * @returns {DataRequest} The request it makes.
 */
function parseDataRequest(payload: unknown): DataRequest {
  const request = { query: text(payload, 'query'), source: text(payload, 'source') };
  return hasField(payload, 'params') ? { ...request, params: text(payload, 'params') } : request;
}

export { EffectPayloadError, field, fx, hasField, parseDataRequest, parseDriveInkOp, parseScheduleCommit, text };
export type { CommitToken, DataRequest, DriveInkOp, Effect, EffectFamily, ScheduleCommit };
