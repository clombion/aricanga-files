import { captureConsoleCodes, recorded, runFixture } from './_helpers';
import { expect, test } from '@playwright/test';
import type { SpecArguments } from './_helpers';

// The failure model: a boundary per part contains the throw and keeps its siblings; the throwing
// branch's settled cleanup does not run; an uncaught throw reaches the writer and halts reactivity.
test.describe('the failure model', () => {
  test('a part boundary contains a throw; an unbounded throw halts later updates', async ({ page }: SpecArguments) => {
    const codes = captureConsoleCodes(page);
    const state = await runFixture(page, 'errored');
    expect(recorded(state, 'errored/part-boundary-contains-a-throw').ok).toBe(true);
    expect(recorded(state, 'errored/throwing-branch-cleanup').note).toBe('settled cleanups run when part b threw: 0');
    const unbounded = recorded(state, 'errored/unbounded-throw');
    expect(unbounded.threw).toBe(true);
    expect(unbounded.note).toBe('thrown: unbounded throw; a later update threw: <nothing>; text after it: ');
    expect(codes).toContain('REACTIVITY_HALTED');
  });
});
