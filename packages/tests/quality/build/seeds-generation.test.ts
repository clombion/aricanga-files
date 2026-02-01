/**
 * Seeds Generation Quality Tests
 *
 * Validates that build-time seed extraction produces correct output.
 * These tests verify the generated seeds.js file has:
 * 1. Messages for each chat (except disappearing chats)
 * 2. All required message fields
 * 3. _isSeed: true marker on every seed
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Path to generated seeds (will be created by build:seeds task)
const SEEDS_PATH = join(
  process.cwd(),
  'experiences/aricanga/src/generated/seeds.js',
);

// Chat IDs that should have seeds (from config)
const EXPECTED_CHAT_IDS = ['news', 'pat', 'notes', 'activist'];

// Chats that should NOT have seeds (disappearing chats)
const DISAPPEARING_CHATS = ['spectre'];

// Required fields on every seed message
const REQUIRED_FIELDS = ['id', 'text', 'type', '_isSeed'];

describe('Seeds Generation', () => {
  let SEEDS: Record<string, unknown[]> | null = null;

  beforeAll(async () => {
    // Skip if seeds.js doesn't exist yet (test will fail, signaling build needed)
    if (existsSync(SEEDS_PATH)) {
      // Dynamic import to get the SEEDS export
      const module = await import(SEEDS_PATH);
      SEEDS = module.SEEDS;
    }
  });

  it('seeds.js file exists after build', () => {
    expect(existsSync(SEEDS_PATH)).toBe(true);
  });

  it('SEEDS export is defined and is an object', () => {
    expect(SEEDS).toBeDefined();
    expect(typeof SEEDS).toBe('object');
    expect(SEEDS).not.toBeNull();
  });

  it('each expected chat has a messages array', () => {
    if (!SEEDS) return; // Will fail on previous test

    for (const chatId of EXPECTED_CHAT_IDS) {
      expect(SEEDS[chatId]).toBeDefined();
      expect(Array.isArray(SEEDS[chatId])).toBe(true);
      expect(SEEDS[chatId].length).toBeGreaterThan(0);
    }
  });

  it('disappearing chats have no seeds', () => {
    if (!SEEDS) return;

    for (const chatId of DISAPPEARING_CHATS) {
      const seeds = SEEDS[chatId];
      // Either undefined, null, or empty array
      expect(!seeds || seeds.length === 0).toBe(true);
    }
  });

  it('all messages have _isSeed: true (critical for notification filtering)', () => {
    if (!SEEDS) return;

    for (const [chatId, messages] of Object.entries(SEEDS)) {
      if (!Array.isArray(messages)) continue;

      for (const msg of messages) {
        expect((msg as { _isSeed?: boolean })._isSeed).toBe(true);
      }
    }
  });

  it('all messages have required fields', () => {
    if (!SEEDS) return;

    for (const [chatId, messages] of Object.entries(SEEDS)) {
      if (!Array.isArray(messages)) continue;

      for (const msg of messages as Record<string, unknown>[]) {
        for (const field of REQUIRED_FIELDS) {
          expect(msg[field]).toBeDefined();
        }
      }
    }
  });

  it('news chat seeds have correct message types', () => {
    if (!SEEDS) return;

    const newsSeeds = SEEDS.news as { type: string }[];
    expect(newsSeeds).toBeDefined();

    // All news seeds should be received (it's a channel)
    for (const msg of newsSeeds) {
      expect(msg.type).toBe('received');
    }
  });

  it('notes chat seeds have sent type (player memos)', () => {
    if (!SEEDS) return;

    const notesSeeds = SEEDS.notes as { type: string }[];
    expect(notesSeeds).toBeDefined();

    // All notes seeds should be sent (player's own notes)
    for (const msg of notesSeeds) {
      expect(msg.type).toBe('sent');
    }
  });

  it('seeds have time tags preserved', () => {
    if (!SEEDS) return;

    // At least some seeds should have time tags
    const allSeeds = Object.values(SEEDS).flat() as { time?: string }[];
    const seedsWithTime = allSeeds.filter((msg) => msg.time);

    expect(seedsWithTime.length).toBeGreaterThan(0);
  });

  it('seeds have unique IDs', () => {
    if (!SEEDS) return;

    const allIds = new Set<string>();
    const allSeeds = Object.values(SEEDS).flat() as { id: string }[];

    for (const msg of allSeeds) {
      expect(allIds.has(msg.id)).toBe(false);
      allIds.add(msg.id);
    }
  });
});
