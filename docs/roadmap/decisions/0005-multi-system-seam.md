# ADR-0005: Multi-system seam from the start; feature deferred

- **Status:** Accepted
- **Date:** 2026-06-16
- **Supersedes:** the single-active-system stance in the Phase 1 design open questions

## Context

Open question #1 asked whether an experience may compose more than one active
system. The initial lean was single-system (YAGNI). But hybrid experiences are a
real, common use case — adventure games with simplified phone mechanics,
narrative games with embedded card minigames. The need is not speculative.

On inspection the cost is asymmetric:

- The multi-system **seam** (keyed snapshot, a system registry, a minimal router)
  is marginally more code now and introduces **no dead code** — a single-system
  experience is the degenerate case (registry of one; the router returns it).
- The multi-system **feature** (view-shell/surface management, a real hybrid
  experience, the explicit `# system:` disambiguation tag) is substantial — but
  deferred either way.
- Retrofitting the **seam** later is substantial: `Snapshot`, the host loop, the
  composition root, and reduce-dispatch are load-bearing contracts every system
  and experience depends on. Changing them after the fact is exactly the
  foundational churn the risk-ordered rebuild exists to avoid.
- Single-active-system also bakes in the single-consumer assumption that
  ADR-0004 (design for two) warns against.

## Decision

Build the multi-system **seam** in Phase 1; defer the **feature**.

**Build now:**
- `Snapshot.systems` keys system slices by id, not a single slice.
- `createExperience` takes `systems: System[]` plus optional `foreground` and
  `router`.
- A minimal `Router` contract with a default strategy — route a chunk to the
  first system claiming one of its tags, else the foreground system. Small and
  swappable.
- The Phase 1 proof (task-015) registers chat **and** cards together and routes
  by tag — a stronger orthogonality proof than swapping a single system.

**Defer:**
- View-shell / surface (overlay) management → Phase 3+.
- The explicit `# system:` routing tag (disambiguation override) → until a real
  hybrid needs it.
- A real hybrid experience → a later experience phase.

## Consequences

- Single-system experiences (Aricanga, desktop chat) are the degenerate case — no
  dead code, just slightly more generic plumbing.
- The router is the one genuinely new design surface; kept minimal and swappable,
  validated against the chat+cards stubs now and a real hybrid later.
