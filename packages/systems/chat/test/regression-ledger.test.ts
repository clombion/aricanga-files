import { readFileSync } from 'node:fs';
import { erase } from '@narratives/foundation';
import { runStream } from '@narratives/foundation/testing';
import { effectsCarryChatId, notifyOnce, routingOwnership } from '@narratives/system-chat/testing';
import { expect, test } from 'vitest';
import { chatSystem } from '../src/system';
import { FIXTURES, LEDGER } from './regression-ledger';

const ids = new Set(LEDGER.map((e) => e.id));

// AC#2 — audit teeth: every BUG-NNN header in the ledger is dispositioned, and a
// future untriaged BUG-NNN fails here.
test('every BUG-NNN entry in BUG-HISTORY.md is dispositioned in the manifest', () => {
  const md = readFileSync('docs/agents/BUG-HISTORY.md', 'utf8');
  const headers = [...md.matchAll(/^## (BUG-\d+):/gm)].map((m) => m[1]);
  expect(headers.length).toBeGreaterThanOrEqual(13);
  for (const header of headers) expect(ids).toContain(header);
});

// AC#2 — the 19 legacy date-based entries (no stable id) are frozen.
test('the legacy date-based entries are frozen at 19', () => {
  expect(LEDGER.filter((e) => e.legacy).length).toBe(19);
});

test('manifest ids are unique and every entry has a rationale', () => {
  expect(ids.size).toBe(LEDGER.length);
  for (const e of LEDGER) expect(e.rationale.length).toBeGreaterThan(0);
});

// AC#3/#5 — every kernel-physics bug keeps a fixture + predicate + consuming task
// alive (so the durable repro data can't silently rot).
test('every kernel-physics entry has a non-empty fixture, predicate, and task', () => {
  for (const e of LEDGER) {
    if (e.disposition.kind === 'kernel-physics') {
      expect(FIXTURES[e.disposition.fixture]?.length ?? 0).toBeGreaterThan(0);
      expect(e.disposition.predicate).not.toBe('');
      expect(e.disposition.task).toMatch(/^task-\d+$/);
    }
  }
});

// AC#3 — the routing historical scenario is green NOW (asserts only routing).
test('routing regression (cross-chat) is green via routingOwnership', async () => {
  const run = await runStream({ systems: [erase(chatSystem)], foreground: 'chat' }, [...FIXTURES['cross-chat-routing']]);
  expect(routingOwnership(run)).toBeNull();
});

// AC#4 — effectsCarryChatId is exercised over real chat effects (the notify
// fixture produces chat/showNotification with a real chatId); the typing-specific
// scenario lands with task-032.
test('effectsCarryChatId holds over the notification fixture', async () => {
  const run = await runStream({ systems: [erase(chatSystem)], foreground: 'chat' }, [...FIXTURES['duplicate-notifications']]);
  expect(effectsCarryChatId(run)).toBeNull();
});

// task-021 — the dup-notifications regression is now dead: notify-once holds over
// its historical scenario (two messages to one chat → exactly one notification).
test('the duplicate-notifications regression stays dead (notifyOnce green)', async () => {
  const run = await runStream({ systems: [erase(chatSystem)], foreground: 'chat' }, [...FIXTURES['duplicate-notifications']]);
  expect(notifyOnce(run)).toBeNull();
});
