/**
 * Analytics API Contract Test
 *
 * Verifies sync between:
 * - Code: src/foundation/services/event-logger.js (EventLogger class)
 * - Docs: docs/reference/analytics.md (API documentation)
 *
 * Developers adding telemetry rely on the docs to understand
 * the EventLogger API.
 */

import { expect, test } from '@playwright/test';
import {
  extractEventLoggerMethods,
  extractDocumentedAnalyticsMethods,
} from '@narratives/test-utils/helpers';

// Extract at module load
const codeMethods = extractEventLoggerMethods();
const docMethods = extractDocumentedAnalyticsMethods();

// Known public methods that should be documented
const EXPECTED_PUBLIC_METHODS = [
  'start',
  'stop',
  'log',
  'getSessionId',
  'newSession',
  'getSessionEntries',
  'getStore',
];

test.describe('Analytics API Contract', () => {
  test.describe('static analysis', () => {
    test('all public EventLogger methods are documented', () => {
      // Every public method should appear in analytics.md
      const undocumented = EXPECTED_PUBLIC_METHODS.filter(
        method => !docMethods.includes(method)
      );

      expect(
        undocumented,
        `EventLogger methods not documented:\n${undocumented.map(m => `  - ${m}`).join('\n')}\n\nAdd these to docs/reference/analytics.md`
      ).toEqual([]);
    });

    test('all documented methods exist in code', () => {
      // Every documented method should exist in EventLogger
      const stale = docMethods.filter(
        method => !EXPECTED_PUBLIC_METHODS.includes(method)
      );

      expect(
        stale,
        `Methods documented but not in EventLogger:\n${stale.map(m => `  - ${m}`).join('\n')}\n\nRemove stale entries from docs/reference/analytics.md`
      ).toEqual([]);
    });

    test('EventLogger exports expected public methods', () => {
      // Verify our code parser found the expected methods
      for (const method of EXPECTED_PUBLIC_METHODS) {
        expect(
          codeMethods,
          `Expected method "${method}" not found in event-logger.js`
        ).toContain(method);
      }
    });
  });

  test.describe('code verification', () => {
    // EventLogger is not exposed on window - it's instantiated internally in main.js
    // These tests verify the class implementation directly via static analysis

    test('EventLogger class has correct method signatures', () => {
      // Verify the code parser found all expected methods
      expect(codeMethods).toContain('start');
      expect(codeMethods).toContain('stop');
      expect(codeMethods).toContain('log');
      expect(codeMethods).toContain('getSessionId');
      expect(codeMethods).toContain('newSession');
      expect(codeMethods).toContain('getSessionEntries');
      expect(codeMethods).toContain('getStore');
    });

    test('no unexpected public methods in EventLogger', () => {
      // Verify we haven't added undocumented public methods
      const knownMethods = [...EXPECTED_PUBLIC_METHODS];
      const unexpected = codeMethods.filter(m => !knownMethods.includes(m));

      expect(
        unexpected,
        `Unexpected public methods in EventLogger (need documentation):\n${unexpected.map(m => `  - ${m}`).join('\n')}`
      ).toEqual([]);
    });
  });

  test.describe('documentation coverage', () => {
    test('analytics.md mentions key API methods', () => {
      // Verify the parser found expected documented methods
      expect(docMethods).toContain('log');
      expect(docMethods).toContain('getSessionId');
    });

    test('all documented code examples use valid methods', () => {
      // Every method mentioned in docs should be a real method
      for (const method of docMethods) {
        expect(
          EXPECTED_PUBLIC_METHODS,
          `"${method}" appears in docs but isn't a known EventLogger method`
        ).toContain(method);
      }
    });
  });
});

// Note: EventLogger is not exposed on window - tests use static analysis
// Runtime verification is done via integration tests in the main test suite
