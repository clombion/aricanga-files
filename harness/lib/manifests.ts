/**
 * The reading of a population's manifests (`scope.ts` asks it): the root's and each member's, read
 * at one moment, and the member each declares, named as pnpm lists it. pnpm parses every manifest of the
 * workspace before it lists it (`workspace.ts`), and refuses the first that is not JSON as a
 * `PopulationError` naming that file alone; what reaches this module is what pnpm accepted. Of that,
 * one refusal names everything wrong at once, each case by its own words: each manifest that cannot
 * be read (a file gone since pnpm listed it, text `JSON.parse` refuses though pnpm reads it, as with a
 * byte-order mark), each member's manifest that was read and holds an `aricanga` that is no object,
 * and each role word that names no role. It is a `ConfigError` (the boundary's class) when a manifest
 * cannot be read or holds such an `aricanga`, its message naming each one's reason (oxlint's and knip's
 * config loaders print a message and drop its cause) and its `cause` an `AggregateError` of each one's error; a
 * `PopulationError` when every manifest reads and a role is refused. The root declares no role: its
 * `aricanga` is not read.
 */

import { ConfigError, absentAs, object, parsed } from './config.ts';
import type { ListedPackage, Member } from './scope.ts';
import { ROLE_WORDS, isRole } from './roles.ts';
import { PopulationError } from './workspace.ts';
import { byKind } from './by-kind.ts';
import { isEmpty } from './lists.ts';
import { manifestOf } from './package-dirs.ts';
import { present } from './present.ts';

/** A manifest's fields, as its JSON object holds them. */
type Fields = Readonly<Record<string, unknown>>;

/** What one member's manifest declares: the member, or the line its refusal names it by. */
type Declared = Readonly<{ kind: 'member'; member: Member }> | Readonly<{ kind: 'refused'; line: string }>;

/** A member's manifest as read: its fields, and its `aricanga` declaration (none: `{}`). */
interface ReadManifest {
  readonly fields: Fields;
  readonly declaration: Fields;
}

/** A manifest refused, with its refusal. */
interface Refused {
  readonly path: string;
  readonly reason: unknown;
}

/**
 * A member's manifest as its read ends: read, with its declaration; not read; or read, and holding an
 * `aricanga` that is no object.
 */
type MemberRead =
  | Readonly<{ kind: 'read'; listed: ListedPackage; manifest: ReadManifest }>
  | Readonly<{ kind: 'unread'; refused: Refused }>
  | Readonly<{ kind: 'undeclared'; refused: Refused }>;

/**
 * The root's manifest as its read ends: read, with its fields, or unread, with its refusal. It has no
 * third end: the root declares no role, so its `aricanga` is not read.
 */
type RootRead = Readonly<{ kind: 'read'; fields: Fields }> | Readonly<{ kind: 'unread'; refused: Refused }>;

/** The manifests refused, by case: those that cannot be read, and those whose `aricanga` is no object. */
interface RefusedManifests {
  readonly unread: readonly Refused[];
  readonly undeclared: readonly Refused[];
}

/** What a population's manifests read as: the root's fields and the members. */
interface Manifests {
  readonly rootManifest: Fields;
  readonly members: readonly Member[];
}

/**
 * A manifest's text, as its read ends, parsed as the JSON object it holds; text that cannot be read
 * or is not a JSON object refuses with the boundary's own error (`ConfigError` naming the manifest,
 * or the reader's). Each caller reads the manifest where it names its path, so the manifest-reads
 * check sees this module read it.
 *
 * @param {string} path - The manifest's path.
 * @param {Promise<string>} reading - The read of its text.
 * @returns {Promise<Fields>} Its fields.
 */
async function fieldsOf(path: string, reading: Promise<string>): Promise<Fields> {
  const text = await reading;
  return object(parsed(text, path), path);
}

/**
 * A read manifest's `aricanga` object (none: `{}`); one present and no object (`null` included)
 * refuses with `ConfigError` naming the manifest.
 *
 * @param {string} path - The manifest's path.
 * @param {Fields} fields - Its fields.
 * @returns {Promise<Fields>} Its declaration.
 */
async function declarationOf(path: string, fields: Fields): Promise<Fields> {
  const declared = await Promise.resolve(fields['aricanga']);
  return object(absentAs(declared, {}), `${path} aricanga`);
}

/**
 * Work settled: its value or its refusal, the error object kept.
 *
 * @param {Promise<Value>} work - The work.
 * @returns {Promise<PromiseSettledResult<Value>>} Its outcome.
 */
async function settled<Value>(work: Promise<Value>): Promise<PromiseSettledResult<Value>> {
  const [outcome] = await Promise.allSettled([work]);
  return present(outcome, 'the outcome of its own work');
}

/**
 * A member's manifest read, then its declaration, each refusal kept by its case.
 *
 * @param {ListedPackage} listed - The member's package, as pnpm lists it.
 * @param {(listed: string) => Promise<string>} read - Reads a listed file's text.
 * @returns {Promise<MemberRead>} How its read ends.
 */
async function memberRead(listed: ListedPackage, read: (listed: string) => Promise<string>): Promise<MemberRead> {
  const path = manifestOf(listed.dir);
  const fields = await settled(fieldsOf(path, read(path)));
  if (fields.status === 'rejected') {
    return { kind: 'unread', refused: { path, reason: fields.reason } };
  }
  const declaration = await settled(declarationOf(path, fields.value));
  return declaration.status === 'rejected'
    ? { kind: 'undeclared', refused: { path, reason: declaration.reason } }
    : { kind: 'read', listed, manifest: { declaration: declaration.value, fields: fields.value } };
}

/**
 * The root's manifest read: its fields, or its refusal kept.
 *
 * @param {(listed: string) => Promise<string>} read - Reads a listed file's text.
 * @returns {Promise<RootRead>} How its read ends.
 */
async function rootRead(read: (listed: string) => Promise<string>): Promise<RootRead> {
  const path = manifestOf('');
  const outcome = await settled(fieldsOf(path, read(path)));
  return outcome.status === 'fulfilled'
    ? { fields: outcome.value, kind: 'read' }
    : { kind: 'unread', refused: { path, reason: outcome.reason } };
}

/**
 * The root's manifest refused, if its read ended unread.
 *
 * @param {RootRead} root - The root's read.
 * @returns {readonly Refused[]} Its refusal, or none.
 */
function rootRefused(root: RootRead): readonly Refused[] {
  return byKind(root, { read: () => [], unread: (unread) => [unread.refused] });
}

/**
 * The member a manifest declares, or the line refusing the word it declares that names no role.
 *
 * @param {ListedPackage} listed - The member's package, as pnpm lists it: its directory and name.
 * @param {ReadManifest} manifest - Its manifest, as read.
 * @returns {Declared} The member, or its refusal's line.
 */
function declaredBy(listed: ListedPackage, manifest: Readonly<ReadManifest>): Declared {
  const word = manifest.declaration['role'];
  const { dir, name } = listed;
  return isRole(word)
    ? { kind: 'member', member: { dir, manifest: manifest.fields, name, role: word } }
    : { kind: 'refused', line: `${manifestOf(dir)}: aricanga.role is ${JSON.stringify(word)}` };
}

/**
 * The line naming the manifests of one case, or none when the case holds none.
 *
 * @param {readonly Refused[]} refused - The case's manifests.
 * @param {string} what - What the case says of them.
 * @returns {readonly string[]} Its line, or none.
 */
function caseLine(refused: readonly Refused[], what: string): readonly string[] {
  return isEmpty(refused) ? [] : [`the manifests ${refused.map((entry) => `${entry.path} (${String(entry.reason)})`).join(', ')} ${what}`];
}

/**
 * Refuse a population at once, naming every manifest refused, by its case (the root's first, when it
 * cannot be read), and every role refused: a `ConfigError` whose `cause` gathers each manifest's
 * error when a manifest is refused, else a `PopulationError`; nothing when neither. So the root's
 * read is read once this returns: its type says so to the caller.
 *
 * @param {RefusedManifests} refused - The members' manifests refused, by case.
 * @param {readonly string[]} lines - The refused roles' lines.
 * @param {RootRead} root - The root's read.
 */
function refuseAll(
  refused: RefusedManifests,
  lines: readonly string[],
  root: RootRead,
): asserts root is Extract<RootRead, { kind: 'read' }> {
  const roles = isEmpty(lines)
    ? []
    : [...lines, `a workspace package declares one of the roles of harness/lib/roles.ts (${ROLE_WORDS.join(', ')})`];
  const unread = [...rootRefused(root), ...refused.unread];
  const named = [...caseLine(unread, 'cannot be read'), ...caseLine(refused.undeclared, 'hold an aricanga that is no object')];
  if (!isEmpty(named)) {
    throw new ConfigError([...named, "each refusal is also this one's cause", ...roles].join('; '), {
      cause: new AggregateError(
        [...unread, ...refused.undeclared].map((entry) => entry.reason),
        'each manifest refused',
      ),
    });
  }
  if (!isEmpty(roles)) {
    throw new PopulationError('role', roles.join('; '));
  }
}

/**
 * Every manifest of a population read at one moment, the root's and each member's, and the members
 * they declare; one refusal names each manifest refused, by its case, and each role refused, at once.
 *
 * @param {readonly ListedPackage[]} packages - The members' packages, as pnpm lists them.
 * @param {(listed: string) => Promise<string>} read - Reads a listed file's text.
 * @returns {Promise<Manifests>} The root's manifest and the members.
 */
async function manifestsOf(packages: readonly ListedPackage[], read: (listed: string) => Promise<string>): Promise<Manifests> {
  const rootReading = rootRead(read);
  const memberReads = Promise.all(
    packages.map(async (listed): Promise<MemberRead> => {
      const ended = await memberRead(listed, read);
      return ended;
    }),
  );
  const [root, reads] = await Promise.all([rootReading, memberReads]);
  const declared = reads.flatMap((entry): readonly Declared[] =>
    byKind(entry, { read: (manifest) => [declaredBy(manifest.listed, manifest.manifest)], undeclared: () => [], unread: () => [] }),
  );
  const members = declared.flatMap((entry): readonly Member[] => byKind(entry, { member: (member) => [member.member], refused: () => [] }));
  refuseAll(
    {
      undeclared: reads.flatMap((entry) =>
        byKind(entry, { read: () => [], undeclared: (undeclared) => [undeclared.refused], unread: () => [] }),
      ),
      unread: reads.flatMap((entry) => byKind(entry, { read: () => [], undeclared: () => [], unread: (unread) => [unread.refused] })),
    },
    declared.flatMap((entry) => byKind(entry, { member: () => [], refused: (refused) => [refused.line] })),
    root,
  );
  return { members, rootManifest: root.fields };
}

export { manifestsOf };
export type { Fields };
