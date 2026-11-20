/**
 * CSP: what the compiler writes for a `style` prop, under `script-src 'self'; style-src 'self'`.
 * The spec serves this page with that policy and records every violation the page reports.
 */

import { markDone, record } from '#src/harness';
import { mount, settle } from '#src/support';
import { flush } from 'solid-js';

/** What the listener reads of a violation. */
type Violation = Readonly<Pick<SecurityPolicyViolationEvent, 'sample' | 'violatedDirective'>>;

/** What the ref writes through. */
type Styled = Readonly<{ style: Readonly<Pick<CSSStyleDeclaration, 'setProperty'>> }>;

/** Where the fixture reads the paragraphs back. */
type Page = Readonly<Pick<ParentNode, 'querySelector'>>;

/** The colour every paragraph asks for. */
const COLOR = 'rgb(255, 0, 0)';

/** A page that reported no violation. */
const NO_VIOLATIONS = 0;

/**
 * Collect every violation the page reports from now on.
 * @returns {string[]} The violations seen so far, appended as they come.
 */
function violationsSeen(): readonly string[] {
  const seen: string[] = [];
  document.addEventListener('securitypolicyviolation', (event: Violation) => {
    seen.push(`${event.violatedDirective}: ${event.sample}`);
  });
  return seen;
}

/**
 * The computed colour of a paragraph.
 * @param {ParentNode} page Where the paragraph is rendered.
 * @param {string} id The paragraph's id.
 * @returns {string} Its computed colour, or `<none>` when it is missing.
 */
function computed(page: Page, id: string): string {
  const element = page.querySelector(`#${id}`);
  return element === null ? '<none>' : getComputedStyle(element).color;
}

/**
 * Record what each style path applied and every violation reported.
 * @param {ParentNode} page Where the paragraphs are rendered.
 * @param {string[]} violations The violations seen.
 */
function recordStyles(page: Page, violations: readonly string[]): void {
  record({
    id: 'csp/style-prop',
    note: `style prop color: ${computed(page, 'object')}; attribute: ${page.querySelector('#object')?.getAttribute('style') ?? '<none>'}`,
    ok: true,
    threw: false,
  });
  record({
    id: 'csp/cssom-from-a-ref-applies',
    note: `ref + style.setProperty color: ${computed(page, 'cssom')}`,
    ok: computed(page, 'cssom') === COLOR,
    threw: false,
  });
  record({
    id: 'csp/violations',
    note: `violations: ${violations.length > NO_VIOLATIONS ? violations.join(' | ') : 'none'}`,
    ok: true,
    threw: false,
  });
}

/** Render a style prop, a class and a CSSOM write from a ref, then record what applied. */
async function run(): Promise<void> {
  const violations = violationsSeen();
  const { host, dispose } = mount('div', () => (
    <>
      {/* oxlint-disable-next-line aricanga/style-prop -- the planted style prop whose CSP effect this fixture records */}
      <p id="object" style={{ color: COLOR }}>
        object style
      </p>
      <p id="classed" class="chx-red">
        class style
      </p>
      <p
        id="cssom"
        ref={(element: Styled) => {
          element.style.setProperty('color', COLOR);
        }}
      >
        cssom style
      </p>
    </>
  ));
  flush();
  await settle();
  recordStyles(host, violations);
  dispose();
  markDone();
}

export { run };
