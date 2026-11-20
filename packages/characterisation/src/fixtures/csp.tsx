/**
 * CSP: what the compiler writes for a `style` prop, under `script-src 'self'; style-src 'self'`.
 * The spec serves this page with that policy and records every violation the page reports.
 */

import { render } from '@solidjs/web';
import { flush } from 'solid-js';

import { markDone, record } from '../harness';

const violations: string[] = [];
document.addEventListener('securitypolicyviolation', (event) => {
  violations.push(`${event.violatedDirective}: ${event.sample}`);
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export async function run(): Promise<void> {
  const host = document.createElement('div');
  document.body.append(host);
  const color = 'rgb(255, 0, 0)';
  const dispose = render(
    () => (
      <>
        {/* oxlint-disable-next-line aricanga/style-prop -- the planted style prop whose CSP effect this fixture records */}
        <p id="object" style={{ color }}>
          object style
        </p>
        <p id="classed" class="chx-red">
          class style
        </p>
        <p
          id="cssom"
          ref={(element) => {
            element.style.setProperty('color', color);
          }}
        >
          cssom style
        </p>
      </>
    ),
    host,
  );
  flush();
  await settle();
  const computed = (id: string): string => {
    const element = host.querySelector(`#${id}`);
    return element === null ? '<none>' : getComputedStyle(element).color;
  };
  record({
    id: 'csp/style-prop',
    ok: true,
    threw: false,
    note: `style prop color: ${computed('object')}; attribute: ${host.querySelector('#object')?.getAttribute('style') ?? '<none>'}`,
  });
  record({
    id: 'csp/cssom-from-a-ref-applies',
    ok: computed('cssom') === color,
    threw: false,
    note: `ref + style.setProperty color: ${computed('cssom')}`,
  });
  record({
    id: 'csp/violations',
    ok: true,
    threw: false,
    note: `violations: ${violations.length === 0 ? 'none' : violations.join(' | ')}`,
  });
  dispose();
  host.remove();
  markDone();
}
