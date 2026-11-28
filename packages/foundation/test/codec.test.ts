import { InputRefusedError, decodeSnapshot } from '@narratives/foundation';
import { describe, test } from 'vitest';

/** A save whose envelope lacks the ink state a restore drives the story from. */
const NO_INK = '{"version":1,"idSeq":0,"state":{}}';

/** A save whose id sequence is text, not a number. */
const TEXT_SEQ = '{"version":1,"ink":"{}","idSeq":"3","state":{}}';

/** A save whose state is a list, not a record keyed by system. */
const LIST_STATE = '{"version":1,"ink":"{}","idSeq":0,"state":[]}';

describe('the snapshot codec', () => {
  test('refuses a save whose envelope lacks a field, naming the field', ({ expect }) => {
    expect.hasAssertions();
    expect(() => decodeSnapshot(NO_INK)).toThrow(new InputRefusedError('system "snapshot" refuses ink: undefined'));
  });

  test('refuses a save whose envelope field has the wrong type, naming the value', ({ expect }) => {
    expect.hasAssertions();
    expect(() => decodeSnapshot(TEXT_SEQ)).toThrow(new InputRefusedError('system "snapshot" refuses idSeq: "3"'));
  });

  test('refuses a save whose state is not a record of systems', ({ expect }) => {
    expect.hasAssertions();
    expect(() => decodeSnapshot(LIST_STATE)).toThrow(new InputRefusedError('system "snapshot" refuses state: []'));
  });
});
