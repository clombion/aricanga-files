/**
 * The fixture registry. Each entry lazily imports a module exposing `run()`; a spec navigates to
 * `/?fixture=<key>` and reads the result bus (`window.chxResults`), the DOM and the console.
 */

export interface Fixture {
  readonly run: () => void | Promise<void>;
}

export const fixtures: Readonly<Record<string, () => Promise<Fixture>>> = {
  adapter: () => import('./fixtures/adapter'),
  'async-views': () => import('./fixtures/async-views'),
  csp: () => import('./fixtures/csp'),
  errored: () => import('./fixtures/errored'),
  events: () => import('./fixtures/events'),
  measurement: () => import('./fixtures/measurement'),
  'mount-dispose': () => import('./fixtures/mount-dispose'),
  ownership: () => import('./fixtures/ownership'),
  performance: () => import('./fixtures/performance'),
  properties: () => import('./fixtures/properties'),
  props: () => import('./fixtures/props'),
};
