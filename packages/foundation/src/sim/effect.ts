// Open, extensible effect channel. Foundation defines the envelope; each system
// contributes its own effect kinds without foundation referencing them.
// FoundationEffect (the foundation-owned kinds) and the host executor land in
// task-009.

export interface Effect<K extends string = string, P = unknown> {
  readonly kind: K;
  readonly payload: P;
}
