import { writeFileSync } from 'node:fs';

import { test } from '@playwright/test';

import { captureConsoleCodes, runFixture } from './_helpers';

const FIXTURES = ['ownership', 'adapter', 'async-views', 'errored', 'measurement', 'events', 'properties', 'props', 'csp', 'performance'];
const POLICY = "script-src 'self'; style-src 'self'";

for (const name of FIXTURES) {
  test(`observe ${name}`, async ({ page }, info) => {
    if (name === 'csp') {
      await page.route('**/?fixture=csp', async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': POLICY } });
      });
    }
    const codes = captureConsoleCodes(page);
    const state = await runFixture(page, name);
    const extra: Record<string, string> = {};
    if (name === 'events') {
      await page.locator('chx-events-host').locator('#delegated').click();
      extra['after a real click'] = (await page.locator('chx-events-host').locator('#delegated').textContent()) ?? '';
    }
    writeFileSync(info.outputPath('observed.json'), JSON.stringify({ name, project: info.project.name, state, codes, extra }, null, 2));
  });
}
