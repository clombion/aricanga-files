/**
 * The fixture registry: every module under `fixtures/`, imported lazily and keyed by its file name.
 * A spec navigates to `/?fixture=<name>` and reads the result bus (`globalThis.chxResults`), the DOM
 * and the console.
 */

/** A fixture module: its `run` writes its records to the bus and marks the bus done. */
interface Fixture {
  readonly run: () => void | Promise<void>;
}

const MODULES: Readonly<Record<string, () => Promise<unknown>>> = import.meta.glob('./fixtures/*.tsx');

const FIXTURE_FILE = /^\.\/fixtures\/(?<name>[a-z-]+)\.tsx$/u;

/**
 * The fixture name a module path stands for.
 * @param {string} path A key of the glob.
 * @returns {string} The file name without its directory and extension.
 */
function nameOf(path: string): string {
  return FIXTURE_FILE.exec(path)?.groups?.['name'] ?? path;
}

/**
 * Whether a loaded module is a fixture.
 * @param {unknown} loaded The module namespace.
 * @returns {boolean} Whether it exports a `run` function.
 */
function isFixture(loaded: unknown): loaded is Fixture {
  return typeof loaded === 'object' && loaded !== null && 'run' in loaded && typeof loaded.run === 'function';
}

/**
 * Load the fixture module of a name.
 * @param {string} name A fixture name.
 * @returns {Promise<Fixture | undefined>} The module, or undefined when no fixture has that name.
 */
async function loadFixture(name: string): Promise<Fixture | undefined> {
  const path = Object.keys(MODULES).find((key) => nameOf(key) === name);
  const load = path === undefined ? undefined : MODULES[path];
  if (path === undefined || load === undefined) {
    return undefined;
  }
  const loaded = await load();
  if (!isFixture(loaded)) {
    throw new TypeError(`${path} exports no run function`);
  }
  return loaded;
}

/** Every fixture name, sorted. */
const FIXTURE_NAMES: readonly string[] = Object.keys(MODULES)
  .map((path) => nameOf(path))
  .toSorted();

export { FIXTURE_NAMES, loadFixture };
