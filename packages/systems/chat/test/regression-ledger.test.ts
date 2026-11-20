import { bugHeaders, physicsDispositions, waitedOnIssues } from '#test/ledger-audit';
import { describe, expect, test } from 'vitest';
import { effectsCarryChatId, notifyOnce, routingOwnership } from '@narratives/system-chat/testing';
import { LEDGER } from '#test/regression-ledger';
import { chatSystem } from '#src/system';
import { erase } from '@narratives/foundation';
import { fixture } from '#test/regression-fixtures';
import { readFile } from 'node:fs/promises';
import { runStream } from '@narratives/foundation/testing';

/** BUG-HISTORY.md held at least this many numbered entries when the ledger was written. */
const NUMBERED_AT_AUDIT = 13;
/** The legacy date-based entries, which carry no stable id, are frozen at this count. */
const LEGACY_ENTRIES = 19;
/** An issue reference, such as `#13`. */
const ISSUE_REF = /^#\d+$/u;

const ids = new Set(LEDGER.map((entry) => entry.id));

/**
 * The run of a named regression fixture through the chat kernel alone.
 *
 * @param {string} name - The fixture's name.
 * @returns {Promise<Awaited<ReturnType<typeof runStream>>>} The completed run.
 */
async function replay(name: string): Promise<Awaited<ReturnType<typeof runStream>>> {
  const run = await runStream({ foreground: 'chat', systems: [erase(chatSystem)] }, [...fixture(name)]);
  return run;
}

describe('the ledger audit', () => {
  // AC#2: audit teeth. Every BUG-NNN header in the ledger is dispositioned, and a
  // future untriaged BUG-NNN fails here.
  test('every BUG-NNN entry in BUG-HISTORY.md is dispositioned in the manifest', async () => {
    expect.hasAssertions();
    const markdown = await readFile('docs/agents/BUG-HISTORY.md', 'utf8');
    const headers = bugHeaders(markdown);
    expect(headers.length).toBeGreaterThanOrEqual(NUMBERED_AT_AUDIT);
    expect(headers.filter((header) => !ids.has(header))).toStrictEqual([]);
  });

  // AC#2: the legacy date-based entries (no stable id) are frozen.
  test('the legacy date-based entries are frozen', () => {
    expect.hasAssertions();
    expect(LEDGER.filter((entry) => entry.legacy)).toHaveLength(LEGACY_ENTRIES);
  });

  test('manifest ids are unique and every entry has a rationale', () => {
    expect.hasAssertions();
    expect(ids.size).toBe(LEDGER.length);
    expect(LEDGER.filter((entry) => entry.rationale === '')).toStrictEqual([]);
  });

  // Every kernel-physics bug keeps a fixture and a predicate alive (so the durable
  // repro data can't silently rot), and every open issue a disposition waits on is
  // written as an issue reference.
  test('every kernel-physics entry has a non-empty fixture and predicate', () => {
    expect.hasAssertions();
    const physics = physicsDispositions();
    expect(physics).not.toStrictEqual([]);
    expect(physics.map((disposition) => fixture(disposition.fixture))).not.toContainEqual([]);
    expect(physics.filter((disposition) => disposition.predicate === '')).toStrictEqual([]);
  });

  test('every issue a disposition waits on is an issue reference', () => {
    expect.hasAssertions();
    const issues = waitedOnIssues();
    expect(issues).toStrictEqual(['#13', '#18', '#38']);
    expect(issues.filter((issue) => !ISSUE_REF.test(issue))).toStrictEqual([]);
  });
});

describe('the kernel-physics regressions', () => {
  // AC#3: the routing historical scenario is green now (asserts only routing).
  test('routing regression (cross-chat) is green via routingOwnership', async () => {
    expect.hasAssertions();
    expect(routingOwnership(await replay('cross-chat-routing'))).toBeUndefined();
  });

  // AC#4: effectsCarryChatId is exercised over real chat effects (the notify
  // fixture produces chat/showNotification with a real chatId); the typing-specific
  // scenario lands with #38.
  test('effectsCarryChatId holds over the notification fixture', async () => {
    expect.hasAssertions();
    expect(effectsCarryChatId(await replay('duplicate-notifications'))).toBeUndefined();
  });

  // The dup-notifications regression is dead: notify-once holds over its historical
  // scenario (two messages to one chat, exactly one notification).
  test('the duplicate-notifications regression stays dead (notifyOnce green)', async () => {
    expect.hasAssertions();
    expect(notifyOnce(await replay('duplicate-notifications'))).toBeUndefined();
  });
});
