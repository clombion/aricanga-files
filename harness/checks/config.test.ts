/** The readers of the tool configuration refuse each value of the wrong shape, naming it. */

import { ConfigError, closure, hooks, tasks } from '#lib/config.ts';
import { describe, expect, test } from 'vitest';

describe('the task reader', () => {
  test('reads a manifest with no scripts as no tasks', () => {
    expect.hasAssertions();
    expect(tasks({ name: 'planted' })).toStrictEqual(new Map());
  });

  test('refuses a script that is not a string, naming it', () => {
    expect.hasAssertions();
    expect(() => tasks({ scripts: { lint: ['oxlint'] } })).toThrow(new ConfigError('script lint is not a string'));
  });

  test('refuses a closure through a task that does not exist, naming it', () => {
    expect.hasAssertions();
    expect(() => closure('check', tasks({ scripts: { check: 'pnpm run gone' } }))).toThrow(new ConfigError('no task named gone'));
  });
});

describe('the hook reader', () => {
  test('reads a hook with no commands as none', () => {
    expect.hasAssertions();
    expect(hooks({ 'pre-commit': {} })).toStrictEqual([]);
  });

  test('refuses a command whose run is not a string, naming it', () => {
    expect.hasAssertions();
    expect(() => hooks({ 'pre-commit': { commands: { gate: { run: true } } } })).toThrow(
      new ConfigError('pre-commit.gate.run is not a string'),
    );
  });
});
