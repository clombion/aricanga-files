
// The BUG-HISTORY disposition audit. Every historical bug stays dead
// either by construction (the pure synchronous reducer removes its mechanism) or
// by a positive regression fixture (its decision rule relocated into `reduce`).
// The meta-test (regression-ledger.test.ts) enforces that every BUG-HISTORY entry
// is dispositioned and that each kernel-physics bug keeps its fixture alive.

/** A GitHub issue of this repository, such as `#13`. */
type IssueRef = `#${number}`;

/**
 * Where a historical bug is held. A kernel-physics bug names the open issue that turns its
 * predicate green, and none once the predicate holds; a deferred bug names the issue it waits on.
 */
type Disposition =
  | {
      readonly kind: 'kernel-physics';
      readonly predicate: string;
      readonly issue?: IssueRef;
      readonly fixture: string;
    }
  | { readonly kind: 'structurally-eliminated' }
  | { readonly kind: 'deferred'; readonly issue: IssueRef }
  | { readonly kind: 'view'; readonly phase: 'Phase 3' }
  | { readonly kind: 'build'; readonly phase: 'Phase 4' };

interface LedgerEntry {
  /** `BUG-NNN` for numbered entries; a stable slug for the 19 legacy date entries. */
  readonly id: string;
  readonly legacy: boolean;
  readonly summary: string;
  readonly disposition: Disposition;
  readonly rationale: string;
}

const LEDGER: readonly LedgerEntry[] = [
  // --- legacy date-based entries (19, frozen) ---
  {
    disposition: { fixture: 'cross-chat-routing', kind: 'kernel-physics', predicate: 'routingOwnership' },
    id: 'cross-chat-message-duplication',
    legacy: true,
    rationale: 'Routing ownership is a live reducer decision (green now); the original content-duplication is a Phase-4 authoring lint.',
    summary: 'Cross-chat messages duplicated between source and target ink.',
  },
  {
    disposition: { fixture: 'duplicate-notifications', kind: 'kernel-physics', predicate: 'notifyOnce' },
    id: 'duplicate-notifications-same-chat',
    legacy: true,
    rationale: 'The async MARK_CHAT_NOTIFIED race is gone, but the dedup gate relocates into reduce — a real kernel decision.',
    summary: 'Multiple notifications fired for one chat in a single update cycle.',
  },
  {
    disposition: { kind: 'structurally-eliminated' },
    id: 'notification-counter-showing-2',
    legacy: true,
    rationale: 'Counter formula split across three components; a single-state view derives the count once — no split source.',
    summary: 'Counter badge showed 2 instead of 1 on fresh start.',
  },
  {
    disposition: { kind: 'structurally-eliminated' },
    id: 'choice-state-lost-roundtrip',
    legacy: true,
    rationale: 'Ink Story is host-owned with per-conversation snapshots (ADR-0007 §4); choice state is not a component field to drop.',
    summary: 'Pending ink choice lost on a chat→hub round-trip.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'parallax-transition-flash',
    legacy: true,
    rationale: 'View-transition/animation timing.',
    summary: 'Instant jump instead of parallax on unread chats.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'waapi-end-frame-snapback',
    legacy: true,
    rationale: 'WAAPI commitStyles timing — view-layer.',
    summary: 'One-frame snap/flash at WAAPI animation end.',
  },
  {
    disposition: { kind: 'structurally-eliminated' },
    id: 'async-close-navigation-race',
    legacy: true,
    rationale: 'No async state transition in the kernel; the runtime owns the loop and executes effects as data.',
    summary: 'Black screen / frozen clicks from an async close + navigation race.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'theme-fouc-on-refresh',
    legacy: true,
    rationale: 'FOUC / initial render — view-layer.',
    summary: 'Black flash around the phone on refresh.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'lockscreen-gradient-fouc',
    legacy: true,
    rationale: 'Shadow-DOM render timing — view-layer.',
    summary: 'Lock-screen gradient missing until shadow DOM renders.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'hub-flash-on-refresh',
    legacy: true,
    rationale: 'FOUC — view-layer.',
    summary: 'Hub briefly visible during refresh.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'waapi-stagger-predelay-opacity',
    legacy: true,
    rationale: 'Animation pre-delay visibility — view-layer.',
    summary: 'Cards visible at full opacity during the stagger delay.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'notification-before-wake-animation',
    legacy: true,
    rationale: 'Render/animation gate — view-layer.',
    summary: 'Notification card appeared before the wake animation finished.',
  },
  {
    disposition: { kind: 'structurally-eliminated' },
    id: 'notification-state-lost-on-refresh',
    legacy: true,
    rationale: 'No component-local notification mirror; one state snapshot persists/restores via the host (Persist), no split SSOT to lose.',
    summary: 'Notifications/counter reset to 0 on refresh.',
  },
  {
    disposition: { kind: 'structurally-eliminated' },
    id: 'double-unread-badge-fresh-start',
    legacy: true,
    rationale: 'Two callers (event + init) set the same counter; a single reducer sets unread once along one path.',
    summary: 'Unread badge showed 2 on a fresh start.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'statusbar-unlock-desync',
    legacy: true,
    rationale: 'Cross-component animation sync — view-layer.',
    summary: 'Status bar updated instantly while the hub slid in on unlock.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'received-bubble-invisible-light',
    legacy: true,
    rationale: 'CSS theming — view-layer.',
    summary: 'Received bubbles invisible in light mode.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'stacked-card-edges-disconnected',
    legacy: true,
    rationale: 'CSS clip-path/box-shadow — view-layer.',
    summary: 'Cards behind the front card looked disconnected.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'overflow-clips-box-shadow',
    legacy: true,
    rationale: 'CSS overflow/box-shadow — view-layer.',
    summary: 'overflow:hidden clipped box-shadow peek edges after expand/collapse.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'notification-entrance-inconsistent',
    legacy: true,
    rationale: 'Animation consistency — view-layer.',
    summary: 'Notification entrance animated differently from the wake stagger.',
  },

  // --- numbered BUG-NNN entries (13) ---
  {
    disposition: { fixture: 'receipt-auto-upgrade', issue: '#13', kind: 'kernel-physics', predicate: 'receiptMonotonic' },
    id: 'BUG-001',
    legacy: false,
    rationale: 'The XState/ChatThread state mirror is gone, but the auto-upgrade decision (delivered→read on reply) is a reducer rule.',
    summary: 'Sent message stayed "delivered" instead of "read" after a reply.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'BUG-002',
    legacy: false,
    rationale: 'Render-before-ready in connectedCallback; view is pure over injected RenderContext.locale — a view-layer concern.',
    summary: 'Raw i18n keys rendered in early-mount components.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'BUG-003',
    legacy: false,
    rationale: 'DOM/Playwright test flakiness — view-layer.',
    summary: 'Flaky view-transition timeouts under parallel test workers.',
  },
  {
    disposition: { kind: 'build', phase: 'Phase 4' },
    id: 'BUG-004',
    legacy: false,
    rationale: 'Ink authoring/parser — build pipeline.',
    summary: 'Ink `//` comment truncated URLs in tags.',
  },
  {
    disposition: { issue: '#18', kind: 'deferred' },
    id: 'BUG-005',
    legacy: false,
    rationale: 'Snapshot schema drift across saves — needs versioned snapshots + a migration chain (not structurally eliminated).',
    summary: 'Stale saved state missing a new seed property.',
  },
  {
    disposition: { kind: 'build', phase: 'Phase 4' },
    id: 'BUG-006',
    legacy: false,
    rationale: 'Code duplication/maintenance, no runtime behavior — build/tooling.',
    summary: '17 components each defined their own escapeHtml().',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'BUG-007',
    legacy: false,
    rationale: 'WAAPI on detached elements — view-layer.',
    summary: 'commitStyles on detached DOM threw a DOMException.',
  },
  {
    disposition: { fixture: 'typing-null-chatid', issue: '#38', kind: 'kernel-physics', predicate: 'effectsCarryChatId' },
    id: 'BUG-008',
    legacy: false,
    rationale: 'Effects-as-data still lets a reducer construct a typing effect with an absent chatId; the guard is a reducer decision. Vacuous until #38 emits typing.',
    summary: 'Typing events emitted with a null chatId.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'BUG-009',
    legacy: false,
    rationale: 'Animation stacking — view-layer.',
    summary: 'Janky lock-screen notification stacking animation.',
  },
  {
    disposition: { kind: 'build', phase: 'Phase 4' },
    id: 'BUG-010',
    legacy: false,
    rationale: 'Build pipeline asset copy.',
    summary: 'Black screen after deploy — story.json not copied to dist.',
  },
  {
    disposition: { kind: 'build', phase: 'Phase 4' },
    id: 'BUG-011',
    legacy: false,
    rationale: 'Bundling/module system — build pipeline.',
    summary: 'Black screen after deploy — TLA circular-dependency deadlock.',
  },
  {
    disposition: { kind: 'view', phase: 'Phase 3' },
    id: 'BUG-012',
    legacy: false,
    rationale: 'View-transition jitter — view-layer.',
    summary: 'Glossary page jitter during a view transition.',
  },
  {
    disposition: { kind: 'structurally-eliminated' },
    id: 'BUG-013',
    legacy: false,
    rationale: 'Listeners accumulated across re-renders; a pure view re-derives with no growing listener set.',
    summary: 'Duplicate glossary transitions from stacked shadowRoot listeners.',
  },
];

export { LEDGER };
export type { Disposition };
