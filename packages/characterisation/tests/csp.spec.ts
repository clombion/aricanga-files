import { expect, test } from '@playwright/test';

import { recorded, runFixture, servePolicy } from './_helpers';

// Under the experiences' policy, the style prop writes a style attribute, which every engine
// reports as a style-src-attr violation (Firefox also drops the style); a ref writing through
// CSSOM applies everywhere. The style prop is banned; dynamic style goes through a ref or a class.
test.describe('CSP', () => {
  test('the style prop violates style-src; CSSOM from a ref applies', async ({ page, browserName }) => {
    await servePolicy(page, 'csp');
    const state = await runFixture(page, 'csp');
    expect(recorded(state, 'csp/violations').note).toContain('style-src-attr');
    expect(recorded(state, 'csp/cssom-from-a-ref-applies').ok).toBe(true);
    const styleProp = recorded(state, 'csp/style-prop').note ?? '';
    expect(styleProp).toContain(browserName === 'firefox' ? 'style prop color: rgb(0, 0, 0)' : 'attribute: color:rgb(255, 0, 0)');
  });
});
