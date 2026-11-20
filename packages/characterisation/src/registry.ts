// Fixture registry. Each entry lazily imports a module exposing `run(): Promise<void>`.
// A spec navigates to `/?fixture=<key>` and asserts on window.__chx / the DOM / console.
type Fixture = { run: () => void | Promise<void> };

export const fixtures: Record<string, () => Promise<Fixture>> = {
  'mount-dispose': () => import('./fixtures/mount-dispose'),
};
