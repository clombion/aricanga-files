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
ink → StoryChunk → System.reduce(state, chunk, ctx) → { state, effects }
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

// Generic snapshot — the system slice is opaque to foundation.
interface Snapshot<TSystemState> {
  version: number;          // for migrations
  ink: string;              // ink state JSON (opaque)
  seed: number;             // determinism seed for id generation
  system: TSystemState;     // chat: ChatState · cards: CardsState
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

// Composition root — instance-scoped services, no singletons.
interface Services { clock: Clock; storage: Storage; analytics: AnalyticsSink; bus: EventBus; }
function createExperience(config: {
  storyUrl: string;
  system: System<unknown, unknown>;   // one active system per experience
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

## Open questions (resolve while implementing task-008…015)

- Exact `StoryChunk` shape distinguishing message points from choice points.
- Whether `ReduceContext` carries i18n, or localization is purely a view concern.
- The migration-hook signature keyed off `Snapshot.version`.
- Whether an experience may compose **more than one** active system (deferred —
  YAGNI until a multi-system experience exists; the `# system:` routing tag stays
  unbuilt).
