import { parseTag } from '@narratives/foundation';
import type { FixtureInput } from '@narratives/foundation/testing';

// The BUG-HISTORY disposition audit (task-019). Every historical bug stays dead
// either by construction (the pure synchronous reducer removes its mechanism) or
// by a positive regression fixture (its decision rule relocated into `reduce`).
// The meta-test (regression-ledger.test.ts) enforces that every BUG-HISTORY entry
// is dispositioned and that each kernel-physics bug keeps its fixture alive.

export type Disposition =
  | { readonly kind: 'kernel-physics'; readonly predicate: string; readonly task: string; readonly fixture: string }
  | { readonly kind: 'structurally-eliminated' }
  | { readonly kind: 'deferred'; readonly task: string }
  | { readonly kind: 'view'; readonly phase: 'Phase 3' }
  | { readonly kind: 'build'; readonly phase: 'Phase 4' };

export interface LedgerEntry {
  /** `BUG-NNN` for numbered entries; a stable slug for the 19 legacy date entries. */
  readonly id: string;
  readonly legacy: boolean;
  readonly summary: string;
  readonly disposition: Disposition;
  readonly rationale: string;
}

const story = (text: string, rawTags: string[] = []): FixtureInput => ({
  input: {
    source: 'story',
    step: { text, tags: rawTags.map(parseTag), choices: [], externalCalls: [], status: 'continue' },
  },
});

// Recorded Input streams for the kernel-physics regressions. The routing scenario
// is asserted green now; the rest carry the durable repro data, asserted green by
// their consuming physics task.
export const FIXTURES: Readonly<Record<string, readonly FixtureInput[]>> = {
  'cross-chat-routing': [
    story('Routes to spectre', ['targetChat: spectre', 'speaker: TonyGov', 'type: received']),
  ],
  'duplicate-notifications': [
    story('First from Maria', ['targetChat: maria', 'speaker: Maria', 'type: received']),
    story('Second from Maria', ['targetChat: maria', 'speaker: Maria', 'type: received']),
  ],
  'receipt-auto-upgrade': [
    story('My question', ['type: sent', 'receipt: delivered']),
    story('Their reply', ['type: received', 'speaker: Pat']),
  ],
  'typing-null-chatid': [
    story('Pat replies from the background', ['targetChat: pat', 'speaker: Pat', 'type: received']),
  ],
};

export const LEDGER: readonly LedgerEntry[] = [
  // --- legacy date-based entries (19, frozen) ---
  {
    id: 'cross-chat-message-duplication',
    legacy: true,
    summary: 'Cross-chat messages duplicated between source and target ink.',
    disposition: { kind: 'kernel-physics', predicate: 'routingOwnership', task: 'task-020', fixture: 'cross-chat-routing' },
    rationale: 'Routing ownership is a live reducer decision (green now); the original content-duplication is a Phase-4 authoring lint.',
  },
  {
    id: 'duplicate-notifications-same-chat',
    legacy: true,
    summary: 'Multiple notifications fired for one chat in a single update cycle.',
    disposition: { kind: 'kernel-physics', predicate: 'notifyOnce', task: 'task-021', fixture: 'duplicate-notifications' },
    rationale: 'The async MARK_CHAT_NOTIFIED race is gone, but the dedup gate relocates into reduce — a real kernel decision.',
  },
  {
    id: 'notification-counter-showing-2',
    legacy: true,
    summary: 'Counter badge showed 2 instead of 1 on fresh start.',
    disposition: { kind: 'structurally-eliminated' },
    rationale: 'Counter formula split across three components; a single-state view derives the count once — no split source.',
  },
  {
    id: 'choice-state-lost-roundtrip',
    legacy: true,
    summary: 'Pending ink choice lost on a chat→hub round-trip.',
    disposition: { kind: 'structurally-eliminated' },
    rationale: 'Ink Story is host-owned with per-conversation snapshots (ADR-0007 §4); choice state is not a component field to drop.',
  },
  {
    id: 'parallax-transition-flash',
    legacy: true,
    summary: 'Instant jump instead of parallax on unread chats.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'View-transition/animation timing.',
  },
  {
    id: 'waapi-end-frame-snapback',
    legacy: true,
    summary: 'One-frame snap/flash at WAAPI animation end.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'WAAPI commitStyles timing — view-layer.',
  },
  {
    id: 'async-close-navigation-race',
    legacy: true,
    summary: 'Black screen / frozen clicks from an async close + navigation race.',
    disposition: { kind: 'structurally-eliminated' },
    rationale: 'No async state transition in the kernel; the runtime owns the loop and executes effects as data.',
  },
  {
    id: 'theme-fouc-on-refresh',
    legacy: true,
    summary: 'Black flash around the phone on refresh.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'FOUC / initial render — view-layer.',
  },
  {
    id: 'lockscreen-gradient-fouc',
    legacy: true,
    summary: 'Lock-screen gradient missing until shadow DOM renders.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'Shadow-DOM render timing — view-layer.',
  },
  {
    id: 'hub-flash-on-refresh',
    legacy: true,
    summary: 'Hub briefly visible during refresh.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'FOUC — view-layer.',
  },
  {
    id: 'waapi-stagger-predelay-opacity',
    legacy: true,
    summary: 'Cards visible at full opacity during the stagger delay.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'Animation pre-delay visibility — view-layer.',
  },
  {
    id: 'notification-before-wake-animation',
    legacy: true,
    summary: 'Notification card appeared before the wake animation finished.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'Render/animation gate — view-layer.',
  },
  {
    id: 'notification-state-lost-on-refresh',
    legacy: true,
    summary: 'Notifications/counter reset to 0 on refresh.',
    disposition: { kind: 'structurally-eliminated' },
    rationale: 'No component-local notification mirror; one state snapshot persists/restores via the host (Persist), no split SSOT to lose.',
  },
  {
    id: 'double-unread-badge-fresh-start',
    legacy: true,
    summary: 'Unread badge showed 2 on a fresh start.',
    disposition: { kind: 'structurally-eliminated' },
    rationale: 'Two callers (event + init) set the same counter; a single reducer sets unread once along one path.',
  },
  {
    id: 'statusbar-unlock-desync',
    legacy: true,
    summary: 'Status bar updated instantly while the hub slid in on unlock.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'Cross-component animation sync — view-layer.',
  },
  {
    id: 'received-bubble-invisible-light',
    legacy: true,
    summary: 'Received bubbles invisible in light mode.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'CSS theming — view-layer.',
  },
  {
    id: 'stacked-card-edges-disconnected',
    legacy: true,
    summary: 'Cards behind the front card looked disconnected.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'CSS clip-path/box-shadow — view-layer.',
  },
  {
    id: 'overflow-clips-box-shadow',
    legacy: true,
    summary: 'overflow:hidden clipped box-shadow peek edges after expand/collapse.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'CSS overflow/box-shadow — view-layer.',
  },
  {
    id: 'notification-entrance-inconsistent',
    legacy: true,
    summary: 'Notification entrance animated differently from the wake stagger.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'Animation consistency — view-layer.',
  },

  // --- numbered BUG-NNN entries (13) ---
  {
    id: 'BUG-001',
    legacy: false,
    summary: 'Sent message stayed "delivered" instead of "read" after a reply.',
    disposition: { kind: 'kernel-physics', predicate: 'receiptMonotonic', task: 'task-024', fixture: 'receipt-auto-upgrade' },
    rationale: 'The XState/ChatThread state mirror is gone, but the auto-upgrade decision (delivered→read on reply) is a reducer rule.',
  },
  {
    id: 'BUG-002',
    legacy: false,
    summary: 'Raw i18n keys rendered in early-mount components.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'Render-before-ready in connectedCallback; view is pure over injected RenderContext.locale — a view-layer concern.',
  },
  {
    id: 'BUG-003',
    legacy: false,
    summary: 'Flaky view-transition timeouts under parallel test workers.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'DOM/Playwright test flakiness — view-layer.',
  },
  {
    id: 'BUG-004',
    legacy: false,
    summary: 'Ink `//` comment truncated URLs in tags.',
    disposition: { kind: 'build', phase: 'Phase 4' },
    rationale: 'Ink authoring/parser — build pipeline.',
  },
  {
    id: 'BUG-005',
    legacy: false,
    summary: 'Stale saved state missing a new seed property.',
    disposition: { kind: 'deferred', task: 'task-059' },
    rationale: 'Snapshot schema drift across saves — needs versioned snapshots + a migration chain (not structurally eliminated).',
  },
  {
    id: 'BUG-006',
    legacy: false,
    summary: '17 components each defined their own escapeHtml().',
    disposition: { kind: 'build', phase: 'Phase 4' },
    rationale: 'Code duplication/maintenance, no runtime behavior — build/tooling.',
  },
  {
    id: 'BUG-007',
    legacy: false,
    summary: 'commitStyles on detached DOM threw a DOMException.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'WAAPI on detached elements — view-layer.',
  },
  {
    id: 'BUG-008',
    legacy: false,
    summary: 'Typing events emitted with a null chatId.',
    disposition: { kind: 'kernel-physics', predicate: 'effectsCarryChatId', task: 'task-032', fixture: 'typing-null-chatid' },
    rationale: 'Effects-as-data still lets a reducer construct a typing effect with an absent chatId; the guard is a reducer decision. Vacuous until task-032 emits typing.',
  },
  {
    id: 'BUG-009',
    legacy: false,
    summary: 'Janky lock-screen notification stacking animation.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'Animation stacking — view-layer.',
  },
  {
    id: 'BUG-010',
    legacy: false,
    summary: 'Black screen after deploy — story.json not copied to dist.',
    disposition: { kind: 'build', phase: 'Phase 4' },
    rationale: 'Build pipeline asset copy.',
  },
  {
    id: 'BUG-011',
    legacy: false,
    summary: 'Black screen after deploy — TLA circular-dependency deadlock.',
    disposition: { kind: 'build', phase: 'Phase 4' },
    rationale: 'Bundling/module system — build pipeline.',
  },
  {
    id: 'BUG-012',
    legacy: false,
    summary: 'Glossary page jitter during a view transition.',
    disposition: { kind: 'view', phase: 'Phase 3' },
    rationale: 'View-transition jitter — view-layer.',
  },
  {
    id: 'BUG-013',
    legacy: false,
    summary: 'Duplicate glossary transitions from stacked shadowRoot listeners.',
    disposition: { kind: 'structurally-eliminated' },
    rationale: 'Listeners accumulated across re-renders; a pure view re-derives with no growing listener set.',
  },
];
