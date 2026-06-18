# Phase 1 — Foundation contracts (design)

> Draft target design for [Phase 1](phase-1-foundation.md). The shapes below are
> what tasks `task-008`…`task-015` implement and prove. This is the gate the rest
> of the rebuild hangs off, so it is designed against **two** vocabularies (chat
> *and* cards) up front.

## Roles and data flow — one bus, unidirectional

Three mechanisms, deliberately non-overlapping (the POC had four tangled ones):

- **Rendering** — `snapshot → deriveViewModel(state) → Lit`. The view is a pure
  function of state; it holds no domain state and needs no events to render.
- **Effects** — `reduce` returns `effects[]`, a to-do list the host executes
  (save, schedule a timer, show a notification, request data, emit). Effects are
  **data**, never imperative calls inside the kernel.
- **Event bus (single)** — a stream of `DomainEvent`s for cross-cutting sinks
  only: analytics and cross-system coordination. Populated by the
  `foundation/emit` effect.

```
ink → StoryChunk → Router → System.reduce(slice, chunk, ctx) → { slice, effects }
                              │                              │
                     deriveViewModel(state)                  ├─ host executes effects
                              │                              └─ foundation/emit → EventBus → { analytics, other systems }
                              ▼
                             Lit
```

## Core types (foundation — vocabulary-agnostic)

```ts
// What ink emits, with no chat/card vocabulary in sight.
interface Tag { key: string; value?: string; raw: string; }   // parsed "# key:value"
interface Choice { index: number; text: string; tags: Tag[]; }
interface StoryChunk {
  text: string;
  tags: Tag[];
  choices: Choice[];        // present at a choice point, else empty
  isChoicePoint: boolean;
}

// Open/extensible effect channel. Foundation never enumerates system effects.
type Effect<K extends string = string, P = unknown> = { kind: K; payload: P };

type FoundationEffect =
  | Effect<'foundation/save', void>
  | Effect<'foundation/advanceTime', { minutes: number }>
  | Effect<'foundation/requestData', { source: string; query: string; params?: string }>
  | Effect<'foundation/emit', DomainEvent>;

type SystemId = string;

// Generic snapshot — each slice is opaque to foundation; the systems map keys
// slices by system id, so one or more systems can coexist (ADR-0005).
interface Snapshot<TSystems extends Record<SystemId, unknown>> {
  version: number;          // for migrations
  ink: string;              // ink state JSON (opaque)
  seed: number;             // determinism seed for id generation
  systems: TSystems;        // { chat: ChatState } or { adventure: ..., chat: ... }
}

// Injected, deterministic context — no Date.now()/Math.random() in reduce.
interface ReduceContext { now: number; nextId: () => string; }

interface ReduceResult<TState> { state: TState; effects: Effect[]; }

// The contract every system implements.
interface System<TSystemState, TViewModel> {
  readonly id: string;
  readonly tags: readonly string[];                 // tag vocabulary this system claims
  init(): TSystemState;
  reduce(state: TSystemState, chunk: StoryChunk, ctx: ReduceContext): ReduceResult<TSystemState>;
  deriveViewModel(state: TSystemState): TViewModel; // pure
  registerComponents(): Promise<void> | void;       // host calls once
}

// Single event bus for cross-cutting sinks only.
interface DomainEvent { type: string; [k: string]: unknown; }
interface EventBus {
  emit(event: DomainEvent): void;
  on<E extends DomainEvent>(type: E['type'], fn: (e: E) => void): () => void;
}

// Routing — which system handles a chunk. Default: the first system claiming one
// of the chunk's tags, else the foreground system. The explicit `# system:` tag
// is an optional override, deferred until a hybrid needs it (ADR-0005).
interface Router { route(chunk: StoryChunk, ctx: RouteContext): SystemId; }
interface RouteContext {
  foreground: SystemId;
  systems: ReadonlyMap<SystemId, System<unknown, unknown>>;
}

// Composition root — instance-scoped services, no singletons.
interface Services { clock: Clock; storage: Storage; analytics: AnalyticsSink; bus: EventBus; }
function createExperience(config: {
  storyUrl: string;
  systems: System<unknown, unknown>[];  // one or more; single-system is the degenerate case
  foreground?: SystemId;                // defaults to systems[0].id
  router?: Router;                      // defaults to the tag-ownership strategy
  services: Services;
}): Experience;
```

## Validation against two vocabularies (design for two)

| Concept | Chat | Cards | What foundation sees |
|---|---|---|---|
| State slice | `ChatState` { messageHistory, deferredMessages, lastReadMessageId, notifiedChatIds, currentView } | `CardsState` { deckCursor, stats, history } | `TSystemState` (opaque) |
| Tags claimed | speaker, type, time, duration, targetChat, receipt, immediate | card, stat | `readonly string[]` |
| Effects produced | `chat/showNotification`, `chat/startTyping`, `chat/playSound` | `cards/statChanged`, `cards/cardShown`, `cards/gameOver` | `Effect<string, unknown>` + `FoundationEffect` |
| View-model | hub list + thread bubbles | current card + stat bars | `TViewModel` (opaque) |
| Physics in slice | time coherence, HWM/read cursors, deferral | none | nothing — proves time/HWM belong to **chat**, not foundation |

If cards cannot express its state, tags, effects, and view through these generics
without a foundation change, the contract is wrong. That is the Phase 6 proof —
pulled forward to **compile time** here via the two stubs.

## Determinism

- **Time** is injected via `ReduceContext.now` — no `Date.now()` in `reduce`.
- **IDs** derive from `Snapshot.seed` threaded through the reducer — no `Math.random()`.
- Result: `reduce` is pure → headless property tests (Phase 2) and reproducible saves.

## Open questions

Each is tagged by how it resolves — **decide** (a human call), **discover**
(needs evidence), **derive** (follows from a principle), or **wait** (premature to
specify). Only *decide* questions need a call from us now.

| Question | Mechanism | Status |
|---|---|---|
| Exact `StoryChunk` shape: message vs choice points | **discover** | Open — pin against real inkjs output in the walking skeleton (task-007) |
| `ReduceContext` carries i18n, or localization is a view concern | **derive** | Open — kernel stays locale-agnostic unless ink logic branches on localized values; confirm in Phase 2 |
| Migration-hook signature keyed off `Snapshot.version` | **wait** | Open — cannot be designed until a v1→v2 schema change exists |
| May an experience compose more than one active system? | **decide** | **Resolved — yes; seam now, feature deferred (ADR-0005)** |
