/**
 * The timer guard: a test that leaves a timer pending when it ends fails, so work it started cannot
 * fire inside the next test.
 *
 * While installed, it wraps the global `setTimeout`, `setInterval` and their `clear` functions and
 * records every timer not yet fired or cleared, with the line that set it. `release` clears what is
 * left (so the next test starts clean), restores the real functions and names what was left. A test
 * on fake timers (`vi.useFakeTimers`) sets timers the guard does not see; `vi.useRealTimers` brings
 * the guarded functions back.
 */

import { patch } from './patch.ts';

interface Pending {
  readonly kind: 'timeout' | 'interval';
  readonly at: string;
}

interface Installed {
  /** Clear every pending timer, restore the real functions, and name the timers that were pending. */
  readonly release: () => readonly string[];
}

function caller(): string {
  const line = new Error('timer').stack?.split('\n')[4] ?? '';
  return line.trim().replace(/^at /, '');
}

/** Install the guard. */
export function install(): Installed {
  const pending = new Map<unknown, Pending>();
  const clears = new Map<Pending['kind'], (handle: unknown) => void>();
  const restores = [
    patch(globalThis, 'setTimeout', (real) => (self, [handler, ...rest]) => {
      const at = caller();
      const fire = (...given: unknown[]): void => {
        pending.delete(handle);
        if (typeof handler === 'function') {
          Reflect.apply(handler, self, given);
        }
      };
      const handle = real(self, [fire, ...rest]);
      pending.set(handle, { at, kind: 'timeout' });
      return handle;
    }),
    patch(globalThis, 'setInterval', (real) => (self, args) => {
      const handle = real(self, args);
      pending.set(handle, { at: caller(), kind: 'interval' });
      return handle;
    }),
    patch(globalThis, 'clearTimeout', (real) => {
      clears.set('timeout', (handle) => real(globalThis, [handle]));
      return (self, args) => {
        pending.delete(args[0]);
        return real(self, args);
      };
    }),
    patch(globalThis, 'clearInterval', (real) => {
      clears.set('interval', (handle) => real(globalThis, [handle]));
      return (self, args) => {
        pending.delete(args[0]);
        return real(self, args);
      };
    }),
  ];
  return {
    release: () => {
      const left = [...pending.entries()].map(([handle, timer]) => {
        clears.get(timer.kind)?.(handle);
        return `${timer.kind} set at ${timer.at}`;
      });
      pending.clear();
      for (const restore of restores.toReversed()) {
        restore();
      }
      return left;
    },
  };
}
