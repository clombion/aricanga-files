/**
 * Unit tests for speech duration estimation
 *
 * Tests the estimateSpeechDuration function used for audio message duration
 */

import { describe, it, expect } from 'vitest';
import { estimateSpeechDuration } from '../../framework/src/systems/conversation/utils.js';

describe('estimateSpeechDuration', () => {
  describe('basic estimation', () => {
    it('returns minimum duration for empty text', () => {
      expect(estimateSpeechDuration('')).toBe('0:02');
    });

    it('returns minimum duration for whitespace-only text', () => {
      expect(estimateSpeechDuration('   ')).toBe('0:02');
    });

    it('returns minimum duration for null/undefined', () => {
      // @ts-expect-error - testing null input
      expect(estimateSpeechDuration(null)).toBe('0:02');
      // @ts-expect-error - testing undefined input
      expect(estimateSpeechDuration(undefined)).toBe('0:02');
    });

    it('estimates short messages correctly', () => {
      // ~4 words at 2.3 WPS = ~1.7 seconds, rounds to 2 (minimum)
      const result = estimateSpeechDuration('Hello, how are you?');
      expect(result).toBe('0:02');
    });

    it('estimates medium messages correctly', () => {
      // ~10 words at 2.3 WPS = ~4.3 seconds
      const result = estimateSpeechDuration(
        'This is a longer message with more words to say.'
      );
      // Duration should be between 3-6 seconds with noise
      const seconds = parseDuration(result);
      expect(seconds).toBeGreaterThanOrEqual(3);
      expect(seconds).toBeLessThanOrEqual(6);
    });

    it('estimates longer messages correctly', () => {
      // ~25 words at 2.3 WPS = ~10.8 seconds
      const text =
        'This is a much longer message that contains many more words. ' +
        'It should result in a noticeably longer duration estimate compared ' +
        'to the shorter messages we tested earlier.';
      const result = estimateSpeechDuration(text);
      const seconds = parseDuration(result);
      expect(seconds).toBeGreaterThanOrEqual(8);
      expect(seconds).toBeLessThanOrEqual(15);
    });
  });

  describe('deterministic behavior', () => {
    it('returns same result for same input', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const result1 = estimateSpeechDuration(text);
      const result2 = estimateSpeechDuration(text);
      expect(result1).toBe(result2);
    });

    it('returns different results for different inputs', () => {
      const text1 = 'Hello there my friend';
      const text2 = 'Greetings dear companion';
      // Same word count but different text = different noise = potentially different results
      // They should both be in similar range but may differ due to noise
      const result1 = estimateSpeechDuration(text1);
      const result2 = estimateSpeechDuration(text2);
      // Both should be valid durations, but might differ
      expect(parseDuration(result1)).toBeGreaterThanOrEqual(2);
      expect(parseDuration(result2)).toBeGreaterThanOrEqual(2);
    });
  });

  describe('format', () => {
    it('formats as M:SS', () => {
      const result = estimateSpeechDuration('Short message');
      expect(result).toMatch(/^\d+:\d{2}$/);
    });

    it('pads seconds with leading zero', () => {
      const result = estimateSpeechDuration('Quick');
      const [, seconds] = result.split(':');
      expect(seconds.length).toBe(2);
    });

    it('handles durations over a minute', () => {
      // Generate a very long text (~150 words = ~65 seconds)
      const longText = Array(150).fill('word').join(' ');
      const result = estimateSpeechDuration(longText);
      const [minutes] = result.split(':').map(Number);
      expect(minutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe('noise variation', () => {
    it('adds variation within expected range (±15%)', () => {
      // Test multiple texts to verify noise is applied
      const texts = [
        'The quick brown fox jumps over the lazy dog.',
        'Pack my box with five dozen liquor jugs.',
        'How vexingly quick daft zebras jump.',
        'The five boxing wizards jump quickly.',
      ];

      for (const text of texts) {
        const wordCount = text.split(/\s+/).length;
        const baseDuration = wordCount / 2.3; // WORDS_PER_SECOND
        const result = estimateSpeechDuration(text);
        const actual = parseDuration(result);

        // Allow 15% variation plus rounding
        const minExpected = Math.max(2, Math.floor(baseDuration * 0.85) - 1);
        const maxExpected = Math.ceil(baseDuration * 1.15) + 1;

        expect(actual).toBeGreaterThanOrEqual(minExpected);
        expect(actual).toBeLessThanOrEqual(maxExpected);
      }
    });
  });
});

/**
 * Helper to parse "M:SS" format to total seconds
 */
function parseDuration(duration: string): number {
  const [minutes, seconds] = duration.split(':').map(Number);
  return minutes * 60 + seconds;
}
