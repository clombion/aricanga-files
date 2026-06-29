# Foundation contract

The canonical contract for the `@narratives/foundation` runtime and the `System` interface. Realises ADR-0007 (the closed Input/Effect algebra) and ADR-0005 (multi-system composition). This is the target every system and experience builds against.

## The System contract

A system is a pure pair of functions plus identity:

```ts
interface System<State, Input, Effect, ViewModel> {
  readonly id: SystemId;
  readonly tags: readonly string[];          // ink tag keys this system claims (chunk routing)
  init(seed: number): State;                  // deterministic initial state
  reduce(state: State, input: Input, ctx: ReduceContext): { state: State; effects: readonly Effect[] };
  status(state: State): KernelStatus;         // pure: what the system is waiting for
  view(state: State, render: RenderContext): ViewModel;
}

type KernelStatus = 'free' | 'busy-commit' | 'busy-data';
interface ReduceContext { nextId(): string }  // seeded id source; no clock, no randomness
interface RenderContext { now: number; locale: string }  // host-injected, render-time only
```

`reduce` and `view` perform no I/O, read no clock, and use no randomness. `State` is JSON-serializable, holds no engine serialization and no wall-clock. `Effect` is the foundation's open envelope `{ kind: string; payload }` specialised by each system into a closed union; `Input` is each system's closed union (below).

## The Input algebra (closed by source)

Every value that can drive `reduce`:

```
Input = Story(InkStep)                                  -- the host stepped the ink interpreter
      | Player(Command)                                 -- a player intent
      | Resume(CommitFired tok | DataArrived req value  -- completion of a suspending effect
              | StoryLoaded | Restored snapshot)
      | Lifecycle(Init seed | Reset)                    -- start / restart

InkStep  = { text: string; tags: Tag[]; choices: Choice[]; externalCalls: ExternalCall[]; status: InkStatus }
InkStatus = 'continue' | 'await-choice' | 'await-data' | 'end' | 'error'
```

`Command` is an open, system-addressed channel `{ kind: string; payload }`, mirroring `Effect` but flowing inward. Player commands carry their target inside the payload (e.g. a chat id), never in the routing key.

## The Effect algebra (closed by host capability)

Every value `reduce` returns for the host to perform:

```
Effect = DriveInk(Choose idx | Goto knot | SaveSnap id | LoadSnap id)  -- the host owns the ink Story
       | Schedule(Commit delay tok)                                    -- typing/replay timer
       | Fetch(RequestData req)                                        -- async external data
       | Present(...)                                                  -- imperative UI: notify, typing, sound, receipt, time-change
       | Persist(Save snapshot)                                        -- storage (kernel-initiated)
```

`Present` and `DriveInk` constructors are system-specific; the families are fixed. Effects carry no wall-clock; the host stamps emission time if an analytics sink needs it.

## The generic runtime (Sans-IO host loop)

The foundation runtime drives any system and owns all impure resources. Per step it:

1. Computes readiness from `status(state)` (kernel-owned blocks) combined with host-owned ink readiness (`canContinue` / `choices` / `error`):
   - `busy-commit`/`busy-data` → suspend until the matching `Resume`.
   - else ink `canContinue` → step ink → feed `Story(InkStep)`.
   - else ink has choices → suspend for `Player(Choose)` (host-validated).
   - else idle → suspend for a `Player` or `Lifecycle` input.
2. Calls `reduce`, applies the returned state, executes each `Effect` through a `kind → handler` executor (unknown kind is a typed error, never a silent no-op).
3. Feeds the resulting `Resume` inputs back. Every suspending effect (`Schedule`, `Fetch`, `Lifecycle` load/restore) has exactly one resume; no handshake is implicit.

Player `Open`/`Close` are accepted at any time after host-side validation against config. While a `Schedule(Commit)` is in flight the runtime does not pump new chunks. `bufferGeneration` (a kernel-state epoch) is bumped only by view-change commands; a chaining commit reuses the epoch; a stale `commit` is a no-op.

## Host-owned resources

The host owns and the kernel never touches: the ink `Story` and per-conversation snapshots; the clock; storage; the i18n/data lookups (`name`/`data` resolve into `InkStep.text` via injected deterministic fixtures); timers. Ink mutable side-channels (captured delay, awaiting-data) are drained by the host into `InkStep`/state fields, never persisted on the Story. Persistence is one host-owned snapshot `{ version, ink, state }`; the host autosaves on its own timer (no Input/Effect) and honours `Persist(Save)` for kernel-initiated saves; restore is a `Restored(snapshot)` input that rehydrates both halves.

## Composition root + routing

`createExperience({ systems, services, foreground?, router? })` instantiates instance-scoped services (no module singletons), builds a system registry, and runs the runtime. Routing: `Story(InkStep)` dispatches to the system claiming one of the chunk's tags (else foreground); `Player`/`Resume` commands dispatch to their named system (fail-loud on unknown). One chunk claimed by two systems is a fail-loud ambiguity (the `# system:` override is deferred until a multi-system hybrid needs it). Cross-system coordination is the single event bus; systems never import each other.

## Determinism and purity (enforced)

- Ids are seeded (`ctx.nextId`), not `Date.now`/`Math.random`. Displayed time is simulation-derived (`{ day, minute }`), formatted in `view` via `RenderContext.locale`, never frozen into state.
- A `no-Date.now/Math.random/locale` lint runs over every system's `model` (reducer) package.
- A run-twice deep-equality invariant proves `reduce` determinism. A golden is the recorded `Input→Effect`+`state` stream (kernel-observable, never opaque ink JSON), canonical (sorted keys).
- `Input` and `Effect` handling is exhaustive (TypeScript `never` check); a new boundary crossing fails to compile until it is a constructor.

## Two-vocabulary requirement

The contract is validated against two genuinely different systems — chat (messages, time, read state) and cards (deck, stats; no time/read concepts) — each a closed `Input`/`Effect` algebra driven by the one runtime. Adding or removing a system touches no foundation source.
