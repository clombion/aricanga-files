/** The exemption declarations refuse a list declared wrongly, and a counted list holds its counts exactly. */

import { CountedExemptions, Exemptions, StaleExemptionError } from '#lib/exemptions.ts';
import { describe, expect, test } from 'vitest';

/** A count no entry may hold. */
const BELOW_ONE = 0;

/** The one finding a planted counted entry allows. */
const ONCE = 1;

describe('an exemption list', () => {
  test('refuses an entry without a reason, naming it', () => {
    expect.hasAssertions();
    expect(() => new Exemptions({ planted: '  ' })).toThrow('exemptions without a reason: ["planted"]');
  });

  test('refuses a key grouped under two reasons, naming it', () => {
    expect.hasAssertions();
    expect(() => Exemptions.grouped({ first: ['planted'], second: ['planted'] })).toThrow('"planted" is exempted twice');
  });
});

describe('a counted exemption list', () => {
  test('refuses a count below one, naming the key', () => {
    expect.hasAssertions();
    expect(() => new CountedExemptions({ planted: { count: BELOW_ONE, reason: 'planted' } })).toThrow(
      'counted exemptions below one: ["planted"]',
    );
  });

  test('passes the exact count and fails one more or one fewer', () => {
    expect.hasAssertions();
    const counted = new CountedExemptions({ planted: { count: ONCE, reason: 'planted' } });
    expect(() => {
      counted.assertExact(['planted']);
    }).not.toThrow();
    expect(() => {
      counted.assertExact(['planted', 'planted']);
    }).toThrow(StaleExemptionError);
    expect(() => {
      counted.assertExact([]);
    }).toThrow(StaleExemptionError);
  });
});
