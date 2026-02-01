// tests/implementation/aricanga/fixtures/story-expectations.ts
// Aricanga-specific test expectations - UPDATE WHEN STORY CHANGES
//
// This file centralizes all hardcoded story assumptions used in tests.
// When the narrative changes (times, messages, triggers), update here
// instead of hunting through multiple test files.
//
// Auto-generated values are imported from generated-expectations.ts
// Run: IMPL=aricanga node utils/build/generate-test-expectations.js

// Re-export auto-generated values
export {
  SPEAKERS,
  ENTITY_NAMES,
  CHARACTER_NAMES,
  getName,
} from './generated-expectations';

/**
 * Expected phone clock times after opening each chat and waiting for messages.
 * Format: chatId -> expected time after all initial messages load
 *
 * These are calculated from:
 * - First message's # time: tag
 * - Number of subsequent messages (each drifts +1 minute)
 */
export const EXPECTED_TIMES = {
  // News: game_init OFFICIAL at 8:35, then news_chat messages drift further
  news: '8:42 AM',
  // Pat: after news, Pat messages drift from 8:39 AM
  pat: '8:43 AM',
  // Notes: after Pat choice, research messages drift from 9:15 AM
  notes: '9:17 AM',
} as const;

/**
 * Message fragments that prove a chat has loaded its content.
 * Used with waitForMessage() to know when to check assertions.
 */
export const MESSAGE_MARKERS = {
  // News chat markers
  news: {
    first: 'OFFICIAL —',
    last: 'Royalties',
    hasAricanga: 'Aricanga',
    // Seed messages (historical context before main news)
    seedFirst: 'fiscal report',
    seedSecond: 'Trade delegation',
  },
  // Pat chat markers
  pat: {
    first: 'How was the press conference',
    assignment: "tonight's edition",
    afterChoice: 'File by noon',
    // Choice prompt marker
    choicePrompt: 'What angle',
  },
  // Notes chat markers
  notes: {
    brainstorm: 'Who might know more',
    voiceMemo: 'Pat wants the Aricanga piece',
  },
  // Activist chat markers
  activist: {
    intro: 'Good to finally connect',
  },
} as const;

// SPEAKERS is now imported from generated-expectations.ts

/**
 * Cross-chat triggers - when action in one chat affects another
 */
export const TRIGGERS = {
  // Opening news and seeing announcement triggers Pat notification
  newsToPatNotification: {
    source: 'news',
    target: 'pat',
    targetSpeaker: 'Pat',
    condition: 'seen_announcement becomes true',
  },
  // Making choice in Pat triggers Notes notification
  patChoiceToNotesNotification: {
    source: 'pat',
    target: 'notes',
    condition: 'player_agreed becomes true',
  },
  // Completing Notes research triggers Pat notification
  notesResearchToPatNotification: {
    source: 'notes',
    target: 'pat',
    condition: 'research_complete becomes true',
  },
} as const;

/**
 * Story flow - the expected sequence of chat interactions
 * Tests that depend on story progression should follow this
 */
export const STORY_FLOW = {
  // Entry point - must open this first
  entryChat: 'news',

  // Standard test sequence for full story progression
  sequence: ['news', 'pat', 'notes'] as const,

  // Chats that require prerequisites before showing content
  prerequisites: {
    pat: 'Must open news first (sets seen_announcement)',
    notes: 'Must make choice in pat first (sets player_agreed)',
    activist: 'Can request comment after notes brainstorm',
    spectre: 'Contacts player after article_published',
  },
} as const;

/**
 * Choice text that appears in the story
 */
export const CHOICES = {
  pat: {
    acceptAssignment: 'Straightforward write-up',
    declineAssignment: 'Something feels off',
  },
  notes: {
    ministryOnly: 'Ministry only',
    reachOutMaria: 'Also reach out to',
  },
} as const;

/**
 * Notification expectations
 */
export const NOTIFICATIONS = {
  pat: {
    speaker: 'Pat',
    afterNews: true, // Appears after opening news
  },
  notes: {
    speaker: 'Notes',
    afterPatChoice: true, // Appears after making choice in pat
  },
} as const;

/**
 * System messages by chat type (from TOML config)
 */
export const SYSTEM_MESSAGES = {
  // Type defaults
  types: {
    normal: 'Some messages may not be visible',
    disappearing: 'Disappearing messages are on',
    channel: 'This is the official channel of',
  },
  // Expected per-chat (may include template variables filled in)
  chats: {
    news: 'This is the official channel of Gov News Wire',
    pat: 'Some messages may not be visible',
    notes: 'Some messages may not be visible',
    spectre: 'Disappearing messages are on. Messages will be deleted after 24 hours',
    activist: 'Some messages may not be visible',
  },
} as const;
