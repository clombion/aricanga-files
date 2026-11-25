/**
 * The exemption declarations refuse a list declared wrongly, a counted list holds its counts exactly,
 * and a vocabulary is closed: its words are fixed when it is built and its record has no open keys.
 */

import { CountedExemptions, Exemptions, StaleExemptionError, Vocabulary } from '#lib/exemptions.ts';
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

  test('names, with a stale entry, the findings no entry covers', () => {
    expect.hasAssertions();
    expect(() => new Exemptions({ gone: 'planted' }).unexempted(['new'])).toThrow(
      new StaleExemptionError('stale exemptions, delete them: ["gone"]; findings no entry covers: ["new"]'),
    );
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

/** A class instance whose one member is an accessor over a list its caller keeps. */
class HeldView {
  readonly #items: readonly string[];

  /**
   * A view of `items`.
   *
   * @param {readonly string[]} items - The list, kept by the caller.
   */
  public constructor(items: readonly string[]) {
    this.#items = items;
  }

  /**
   * The list's items.
   *
   * @returns {readonly string[]} The list.
   */
  public get items(): readonly string[] {
    return this.#items;
  }
}

/** A record that can point at itself: `tsc` refuses a recursive fact type, so its link is any object. */
interface Link {
  readonly name: string;
  next: object;
}

/** The refusal of a fact a vocabulary's freeze cannot reach. */
const NO_PLAIN_DATA = "a vocabulary's fact is no plain data";

/** A chain of records deeper than a recursive walk's call stack reaches. */
const DEEP_CHAIN = 100_000;

/**
 * A chain of `DEEP_CHAIN` records, each pointing at the next, ending in `last`.
 *
 * @param {Readonly<Link>} last - The chain's last record.
 * @returns {Readonly<Link>} Its first record.
 */
function deepChain(last: Readonly<Link>): Readonly<Link> {
  let head = last;
  for (const link of Array.from({ length: DEEP_CHAIN }, (): Link => ({ name: 'link', next: {} }))) {
    link.next = head;
    head = link;
  }
  return head;
}

describe('a vocabulary', () => {
  test('freezes the record it was given, so a later write to that record changes nothing here', () => {
    expect.hasAssertions();
    const facts = { kept: { note: 'as built' } };
    const vocabulary = new Vocabulary(facts);
    expect([Reflect.set(facts.kept, 'note', 'changed'), vocabulary.words, vocabulary.of('kept').note]).toStrictEqual([
      false,
      ['kept'],
      'as built',
    ]);
  });

  test('hands out its words, and each fact through every object in it, frozen', () => {
    expect.hasAssertions();
    const vocabulary = new Vocabulary({ word: { flags: ['a'] } });
    const { flags } = vocabulary.of('word');
    expect([
      Object.isFrozen(vocabulary.words),
      Object.isFrozen(vocabulary.of('word')),
      Reflect.set(flags, flags.indexOf('a'), 'b'),
      flags,
    ]).toStrictEqual([true, true, false, ['a']]);
  });

  test('lists words that read as array indices first, ascending, then the others as declared', () => {
    expect.hasAssertions();
    expect(new Vocabulary({ '10': 'ten', '2': 'two', first: 'first', second: 'second' }).words).toStrictEqual([
      '2',
      '10',
      'first',
      'second',
    ]);
  });
});

describe("a vocabulary's facts", () => {
  test('refuses a fact its freeze cannot reach, naming where it is: a class instance over a list the caller keeps, a getter, a function typed as an object', () => {
    expect.hasAssertions();
    const held = ['a'];
    const view = new HeldView(held);
    const getter = {
      get first(): string {
        return held.join(',');
      },
    };
    expect(() => new Vocabulary({ word: { view } })).toThrow(`${NO_PLAIN_DATA}: a class instance at the facts.word.view`);
    expect(() => new Vocabulary({ word: getter })).toThrow(`${NO_PLAIN_DATA}: an accessor at the facts.word.first`);
    const call: object = (): string => held.join(',');
    expect(() => new Vocabulary({ word: { call } })).toThrow(`${NO_PLAIN_DATA}: a function at the facts.word.call`);
  });

  test('reads and freezes the same parts: every own key, a symbol or a non-enumerable one included', () => {
    expect.hasAssertions();
    const hidden = ['a'];
    const keyed = ['b'];
    const key = Symbol('keyed');
    const holder: object = Object.defineProperty({ [key]: keyed }, 'hidden', { enumerable: false, value: hidden });
    const vocabulary = new Vocabulary({ word: { holder } });
    const accessor: object = {
      get [key](): string {
        return hidden.join(',');
      },
    };
    expect(() => new Vocabulary({ word: { accessor } })).toThrow(NO_PLAIN_DATA);
    expect([vocabulary.words, Object.isFrozen(hidden), Object.isFrozen(keyed)]).toStrictEqual([['word'], true, true]);
  });

  test('freezes a chain deeper than the call stack goes', () => {
    expect.hasAssertions();
    const last: Link = { name: 'last', next: {} };
    const vocabulary = new Vocabulary({ word: deepChain(last) });
    expect([vocabulary.words, Object.isFrozen(last)]).toStrictEqual([['word'], true]);
  });

  test('freezes a cyclic record through, and ends', () => {
    expect.hasAssertions();
    const link: Link = { name: 'a', next: {} };
    link.next = link;
    const vocabulary = new Vocabulary({ word: link });
    expect([Object.isFrozen(link), vocabulary.of('word').next === link]).toStrictEqual([true, true]);
  });
});
