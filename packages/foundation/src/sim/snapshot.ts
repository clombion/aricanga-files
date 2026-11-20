type SystemId = string;

// The host-owned persistence envelope (ADR-0007). `state` is the per-system
// kernel state (opaque to foundation; keyed by system id so one or more systems
// coexist, ADR-0005); `ink` is the host's ink serialization; `idSeq` is the
// runtime's persisted id-allocator position so ids never collide across restore.
// `version` drives migrations. The per-system `state` holds no ink and no
// wall-clock.
interface Snapshot<TState extends Readonly<Record<SystemId, unknown>> = Readonly<Record<SystemId, unknown>>> {
  readonly version: number;
  readonly ink: string;
  readonly idSeq: number;
  readonly state: TState;
}

export type { Snapshot, SystemId };
