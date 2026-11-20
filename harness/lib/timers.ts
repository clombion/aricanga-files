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

import { Slot } from './lists.ts';
import { patch } from './patch.ts';
import { present } from './present.ts';

/** A timer not yet fired or cleared, with where it was set. */
interface Pending {
  readonly kind: 'timeout' | 'interval';
  readonly at: string;
}

/** The installed guard. */
interface Installed {
  /** Clear every pending timer, restore the real functions, and name the timers that were pending. */
  readonly release: () => readonly string[];
}

/** A call of a replaced function with its `this` and its arguments. */
type Call = (self: unknown, args: readonly unknown[]) => unknown;

/** The stack frame of the code that set a timer: past the error, `caller`, and the guard's two wrappers. */
const SETTER_FRAME = 4;

const AT = /^at /u;

/**
 * Where the timer being set was set.
 *
 * @returns {string} The setter's stack frame.
 */
function caller(): string {
  const line = present(new Error('timer').stack?.split('\n').at(SETTER_FRAME), 'the stack frame of the code that set the timer');
  return line.trim().replace(AT, '');
}

/** The timers the guard saw set and not yet fired or cleared, and how to clear each kind. */
class Timers {
  public readonly pending = new Map<unknown, Pending>();

  public readonly clears = new Map<Pending['kind'], (handle: unknown) => void>();

  /**
   * A `setTimeout` replacement that records the timer until it fires or is cleared.
   *
   * @param {Call} real - The real `setTimeout`.
   * @returns {Call} The replacement.
   */
  public timeout(real: Call): Call {
    return (self, args) => {
      const [handler, ...rest] = args;
      const own = new Slot<unknown>();
      const fire = (...given: readonly unknown[]): void => {
        this.pending.delete(own.peek());
        if (typeof handler === 'function') {
          Reflect.apply(handler, self, given);
        }
      };
      const handle = real(self, [fire, ...rest]);
      own.put(handle);
      this.pending.set(handle, { at: caller(), kind: 'timeout' });
      return handle;
    };
  }

  /**
   * A `setInterval` replacement that records the timer until it is cleared.
   *
   * @param {Call} real - The real `setInterval`.
   * @returns {Call} The replacement.
   */
  public interval(real: Call): Call {
    return (self, args) => {
      const handle = real(self, args);
      this.pending.set(handle, { at: caller(), kind: 'interval' });
      return handle;
    };
  }

  /**
   * A `clearTimeout` or `clearInterval` replacement that forgets the timer, keeping the real one to
   * clear what a test leaves.
   *
   * @param {Pending['kind']} kind - Which kind of timer it clears.
   * @param {Call} real - The real clearing function.
   * @returns {Call} The replacement.
   */
  public clear(kind: Pending['kind'], real: Call): Call {
    this.clears.set(kind, (handle) => {
      real(globalThis, [handle]);
    });
    return (self, args) => {
      const [handle] = args;
      this.pending.delete(handle);
      return real(self, args);
    };
  }

  /**
   * Clear every pending timer.
   *
   * @returns {readonly string[]} The timers that were pending, named with where they were set.
   */
  public clearLeft(): readonly string[] {
    const left = [...this.pending.entries()].map(([handle, timer]: readonly [unknown, Pending]) => {
      this.clears.get(timer.kind)?.(handle);
      return `${timer.kind} set at ${timer.at}`;
    });
    this.pending.clear();
    return left;
  }
}

/**
 * Install the guard.
 *
 * @returns {Installed} The record whose `release` clears and names what a test left.
 */
function install(): Installed {
  const timers = new Timers();
  const restores = [
    patch(globalThis, 'setTimeout', (real) => timers.timeout(real)),
    patch(globalThis, 'setInterval', (real) => timers.interval(real)),
    patch(globalThis, 'clearTimeout', (real) => timers.clear('timeout', real)),
    patch(globalThis, 'clearInterval', (real) => timers.clear('interval', real)),
  ];
  return {
    release: () => {
      const left = timers.clearLeft();
      for (const restore of restores.toReversed()) {
        restore();
      }
      return left;
    },
  };
}

export { install };
