import { type Snapshot, createIdSequence, parseTag } from '@narratives/foundation';
import { expect, test } from 'vitest';

test('parseTag splits key/value and preserves raw', () => {
  expect(parseTag('speaker: Pat')).toEqual({ key: 'speaker', value: 'Pat', raw: 'speaker: Pat' });
  expect(parseTag('immediate')).toEqual({ key: 'immediate', raw: 'immediate' });
});

test('Snapshot round-trips through JSON to deep-equal (task-008 AC #5)', () => {
  const snap: Snapshot<{ chat: { count: number } }> = {
    version: 1,
    ink: '{"x":1}',
    seed: 42,
    systems: { chat: { count: 3 } },
  };
  expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
});

test('createIdSequence is deterministic and distinct for a seed', () => {
  const a = createIdSequence(42);
  const b = createIdSequence(42);
  const idsA = [a(), a(), a()];
  expect(idsA).toEqual([b(), b(), b()]); // deterministic
  expect(new Set(idsA).size).toBe(3); // distinct
});
