/**
 * The fixture registry. Each entry lazily imports a module exposing `run()`; a spec navigates to
 * `/?fixture=<key>` and reads the result bus (`window.chxResults`), the DOM and the console.
 */

interface Fixture {
  readonly run: () => void | Promise<void>;
}

export const fixtures: Readonly<Record<string, () => Promise<Fixture>>> = {
  adapter:  async () => import('./fixtures/adapter'),
  'async-views':  async () => import('./fixtures/async-views'),
  csp:  async () => import('./fixtures/csp'),
  errored:  async () => import('./fixtures/errored'),
  events:  async () => import('./fixtures/events'),
  measurement:  async () => import('./fixtures/measurement'),
  'mount-dispose':  async () => import('./fixtures/mount-dispose'),
  ownership:  async () => import('./fixtures/ownership'),
  performance:  async () => import('./fixtures/performance'),
  properties:  async () => import('./fixtures/properties'),
  props:  async () => import('./fixtures/props'),
};
