/** The readers of the tool configuration refuse each value of the wrong shape, naming it. */

import { ConfigError, closure, hooks, list, parsed, tasks } from '#lib/config.ts';
import { describe, expect, test } from 'vitest';

describe('the task reader', () => {
  test('reads a manifest with no scripts as no tasks', () => {
    expect.hasAssertions();
    expect(tasks({ name: 'planted' })).toStrictEqual(new Map());
  });

  test('refuses a script that is not a string, naming it', () => {
    expect.hasAssertions();
    expect(() => tasks({ scripts: { lint: ['oxlint'] } })).toThrow(new ConfigError('scripts.lint is not a string: ["oxlint"]'));
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
      new ConfigError('pre-commit.gate.run is not a string: true'),
    );
  });
});

describe('a tool report', () => {
  test('is read as the JSON it holds', () => {
    expect.hasAssertions();
    expect(parsed('{"diagnostics":[]}', 'the planted report')).toStrictEqual({ diagnostics: [] });
  });

  test('that is not JSON is refused, naming the report', () => {
    expect.hasAssertions();
    expect(() => parsed('', 'the planted report')).toThrow(/^the planted report is not JSON: SyntaxError/u);
  });

  test('field that is not a list is refused, naming it', () => {
    expect.hasAssertions();
    expect(list(['a'], 'the planted field')).toStrictEqual(['a']);
    expect(() => list({}, 'the planted field')).toThrow(new ConfigError('the planted field is not a list: {}'));
  });
});
