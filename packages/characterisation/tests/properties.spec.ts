import { characterised, recorded } from './_helpers';
import { expect, test } from '@playwright/test';

// `value`, `checked` and `selected` bind DOM properties, not attributes; defaultValue sets only the
// initial value and leaves what the user typed alone.
test.describe('properties', () => {
  test(
    'bound form state is a property; the default forms are initial only',
    characterised('properties', ({ state }) => {
      for (const id of [
        'properties/value-is-a-property',
        'properties/checked-and-selected-are-properties',
        'properties/default-value-is-initial-only',
        'properties/checked-follows-the-binding',
      ]) {
        expect(recorded(state, id).ok, id).toBe(true);
      }
    }),
  );
});
