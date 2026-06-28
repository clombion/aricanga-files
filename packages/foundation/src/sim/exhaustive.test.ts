import { expect, test } from 'vitest';
import { assertNever } from './exhaustive';
import type { Lifecycle } from './input';

// An exhaustive switch over a closed union compiles and is total.
function describeLifecycle(l: Lifecycle): string {
  switch (l.kind) {
    case 'init':
      return `init:${l.seed}`;
    case 'reset':
      return 'reset';
    default:
      return assertNever(l);
  }
}

test('an exhaustive switch over a closed union compiles and runs', () => {
  expect(describeLifecycle({ kind: 'init', seed: 1 })).toBe('init:1');
  expect(describeLifecycle({ kind: 'reset' })).toBe('reset');
});

test('a non-exhaustive switch fails to compile (proven by @ts-expect-error)', () => {
  function broken(l: Lifecycle): string {
    switch (l.kind) {
      case 'init':
        return `init:${l.seed}`;
      // 'reset' deliberately unhandled — `l` is still inhabited in `default`.
      default:
        // @ts-expect-error - `l` is `{kind:'reset'}` here, not `never`
        return assertNever(l);
    }
  }
  // The typed `init` path still works; the missed case is a compile-time error
  // (the @ts-expect-error above turns into a failure if exhaustiveness is added).
  expect(broken({ kind: 'init', seed: 2 })).toBe('init:2');
});
