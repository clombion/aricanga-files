import { describe, test } from 'vitest';
import type { Lifecycle } from '#src/sim/input';

/** The seed of the `init` lifecycle the tests describe. */
const SEED = 2;

/** The reset lifecycle, written as a typed value. */
const RESET: Extract<Lifecycle, { readonly kind: 'reset' }> = { kind: 'reset' };

/** Each lifecycle kind's description, taking the lifecycle of its own kind: the kernel's dispatch shape. */
type Describers = {
  readonly [TKind in Lifecycle['kind']]: (lifecycle: Extract<Lifecycle, { readonly kind: TKind }>) => string;
};

/** A table that handles every lifecycle kind, so it compiles. */
const DESCRIBERS: Describers = {
  init: (lifecycle) => `init:${lifecycle.seed}`,
  reset: (lifecycle) => lifecycle.kind,
};

// @ts-expect-error -- the planted table misses `reset`: a closed union's table refuses a missing kind
const MISSING: Describers = { init: (lifecycle) => `init:${lifecycle.seed}` };

/**
 * A lifecycle described by the handler of its own kind.
 *
 * @param {Describers} describers - One handler per lifecycle kind.
 * @param {Lifecycle} lifecycle - The lifecycle input.
 * @returns {string} Its description.
 */
function describeBy<TKind extends Lifecycle['kind']>(
  describers: Readonly<Describers>,
  lifecycle: Extract<Lifecycle, { readonly kind: TKind }>,
): string {
  const describer: Describers[TKind] = describers[lifecycle.kind];
  return describer(lifecycle);
}

describe('a dispatch table over a closed union', () => {
  test('handles every kind it is typed by', ({ expect }) => {
    expect.hasAssertions();
    expect(describeBy(DESCRIBERS, { kind: 'init', seed: SEED })).toBe(`init:${SEED}`);
    expect(describeBy(DESCRIBERS, RESET)).toBe(RESET.kind);
  });

  test('missing a kind fails to compile (proven by @ts-expect-error), and that kind has no handler', ({ expect }) => {
    expect.hasAssertions();
    expect(Object.hasOwn(MISSING, RESET.kind)).toBe(false);
  });
});
