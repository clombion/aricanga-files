export type SystemId = string;

// The whole serializable save state. The per-system slices are opaque to
// foundation; the systems map keys them by id so one or more systems coexist
// (ADR-0005). `version` drives migrations; `seed` drives deterministic ids.
export interface Snapshot<TSystems extends Record<SystemId, unknown>> {
  readonly version: number;
  readonly ink: string;
  readonly seed: number;
  readonly systems: TSystems;
}
