import { describe, expect, test } from 'vitest';
import type { AnySystem } from '#src/sim/system';
import { InkRuntime } from '#src/ink/ink-runtime';
import { Runtime } from '#src/host/runtime';
import { compileInk } from '#src/testing/compile';
import { erase } from '#src/sim/system';
import { fixtureSystemErased } from '#src/testing/fixture-system';
import { hSystem } from '#test/h-system';
import { refusingHost } from '#test/refusing-host';

/** The context a view renders with. */
const RENDER = { locale: 'en', now: 0 };

/**
 * A runtime over the given systems and a one-line story.
 *
 * @param {readonly AnySystem[]} systems - The systems.
 * @param {Function} [observe] - Told each reduction's system and the source of its input.
 * @returns {Runtime} The runtime.
 */
function runtimeOf(systems: readonly AnySystem[], observe?: (reduced: string) => void): Runtime {
  return new Runtime({
    host: refusingHost(),
    ink: InkRuntime.fromJson(compileInk('Only line.\n')),
    observer: {
      observe: (record) => {
        observe?.(`${record.systemId}:${record.input.source}`);
      },
    },
    systems,
  });
}

describe('the runtime at its start', () => {
  test('delivers a lifecycle input to every registered system', () => {
    expect.hasAssertions();
    const reduced: string[] = [];
    const runtime = runtimeOf([erase(hSystem), fixtureSystemErased], (record) => {
      reduced.push(record);
    });
    runtime.send({ lifecycle: { kind: 'reset' }, source: 'lifecycle' });
    expect(reduced.filter((record) => record.endsWith(':lifecycle'))).toStrictEqual(['h:lifecycle', 'fixture:lifecycle']);
  });

  test('refuses to start with no system to put in the foreground', () => {
    expect.hasAssertions();
    expect(() => runtimeOf([])).toThrow('Runtime requires at least one system');
  });

  test('refuses a named foreground system it does not hold', () => {
    expect.hasAssertions();
    expect(
      () =>
        new Runtime({
          foreground: 'ghost',
          host: refusingHost(),
          ink: InkRuntime.fromJson(compileInk('Only line.\n')),
          systems: [erase(hSystem)],
        }),
    ).toThrow('foreground system "ghost" is not registered');
  });
});

describe('the runtime once running', () => {
  test('refuses a player input that names no target system', () => {
    expect.hasAssertions();
    const runtime = runtimeOf([erase(hSystem)]);
    expect(() => {
      runtime.send({ command: { kind: 'mint', payload: undefined }, source: 'player' });
    }).toThrow('player/resume input has no known target system (got "<none>")');
  });

  test('restores only the systems it holds, leaving a saved state of another out', () => {
    expect.hasAssertions();
    const runtime = runtimeOf([erase(hSystem)]);
    const saved = runtime.snapshot();
    runtime.restore({ ...saved, state: { ...saved.state, ghost: { anything: true } } });
    expect(Object.keys(runtime.snapshot().state)).toStrictEqual(['h']);
  });

  test('refuses to render the view of a system it does not hold', () => {
    expect.hasAssertions();
    const runtime = runtimeOf([erase(hSystem)]);
    expect(() => runtime.view('ghost', RENDER)).toThrow('unknown system "ghost"');
  });
});
