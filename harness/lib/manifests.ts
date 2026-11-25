/**
 * The reading of a population's manifests (`scope.ts` asks it): every manifest, the root's and each
 * member's, read at one moment, and the member each declares. pnpm parses every manifest of the
 * workspace before it lists it (`workspace.ts`), and refuses the first that is not JSON as a
 * `PopulationError` naming that file alone; what reaches this module is what pnpm accepted. Of that,
 * one refusal names everything wrong at once, each case by its own words: each manifest that cannot
 * be read (a file gone since pnpm listed it, text `JSON.parse` refuses though pnpm reads it, as with a
 * byte-order mark), each member's manifest that was read and holds an `aricanga` that is no object,
 * and each role word that names no role. It is a `ConfigError` (the boundary's class) when a manifest
 * cannot be read or holds such an `aricanga`, its `cause` an `AggregateError` of each one's error; a
 * `PopulationError` when every manifest reads and a role is refused. The root declares no role: its
 * `aricanga` is not read.
 */

import { ConfigError, object, parsed } from './config.ts';
import { ROLE_WORDS, isRole } from './roles.ts';
import type { Member } from './scope.ts';
import type { MemberDir } from './package-dirs.ts';
import { PopulationError } from './workspace.ts';
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
  | Readonly<{ kind: 'read'; dir: MemberDir; manifest: ReadManifest }>
  | Readonly<{ kind: 'unread' | 'undeclared'; refused: Refused }>;

/** The root's manifest as its read ends: its fields, or its refusal. */
interface RootRead {
  readonly fields: Fields | undefined;
  readonly refused: readonly Refused[];
}

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
 * A manifest read as the JSON object it holds; text that cannot be read or is not a JSON object
 * refuses with the boundary's own error (`ConfigError` naming the manifest, or the reader's).
 *
 * @param {string} path - The manifest's path.
 * @param {(listed: string) => Promise<string>} read - Reads a listed file's text.
 * @returns {Promise<Fields>} Its fields.
 */
async function fieldsAt(path: string, read: (listed: string) => Promise<string>): Promise<Fields> {
  const text = await read(path);
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
  return declared === undefined ? {} : object(declared, `${path} aricanga`);
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
 * @param {MemberDir} dir - The member's directory.
 * @param {(listed: string) => Promise<string>} read - Reads a listed file's text.
 * @returns {Promise<MemberRead>} How its read ends.
 */
async function memberRead(dir: MemberDir, read: (listed: string) => Promise<string>): Promise<MemberRead> {
  const path = manifestOf(dir);
  const fields = await settled(fieldsAt(path, read));
  if (fields.status === 'rejected') {
    return { kind: 'unread', refused: { path, reason: fields.reason } };
  }
  const declaration = await settled(declarationOf(path, fields.value));
  return declaration.status === 'rejected'
    ? { kind: 'undeclared', refused: { path, reason: declaration.reason } }
    : { dir, kind: 'read', manifest: { declaration: declaration.value, fields: fields.value } };
}

/**
 * The root's manifest read, its refusal kept.
 *
 * @param {(listed: string) => Promise<string>} read - Reads a listed file's text.
 * @returns {Promise<RootRead>} How its read ends.
 */
async function rootRead(read: (listed: string) => Promise<string>): Promise<RootRead> {
  const path = manifestOf('');
  const outcome = await settled(fieldsAt(path, read));
  return outcome.status === 'fulfilled'
    ? { fields: outcome.value, refused: [] }
    : { fields: undefined, refused: [{ path, reason: outcome.reason }] };
}

/**
 * The member a manifest declares, or the line refusing the word it declares that names no role.
 *
 * @param {MemberDir} dir - The member's directory.
 * @param {ReadManifest} manifest - Its manifest, as read.
 * @returns {Declared} The member, or its refusal's line.
 */
function declaredBy(dir: MemberDir, manifest: Readonly<ReadManifest>): Declared {
  const word = manifest.declaration['role'];
  return isRole(word)
    ? { kind: 'member', member: { dir, manifest: manifest.fields, role: word } }
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
  return isEmpty(refused) ? [] : [`the manifests ${refused.map((entry) => entry.path).join(', ')} ${what}`];
}

/**
 * Refuse a population at once, naming every manifest refused, by its case, and every role refused:
 * a `ConfigError` whose `cause` gathers each manifest's error when a manifest is refused, else a
 * `PopulationError`; nothing when neither.
 *
 * @param {RefusedManifests} refused - The manifests refused, by case.
 * @param {readonly string[]} lines - The refused roles' lines.
 */
function refuseAll(refused: RefusedManifests, lines: readonly string[]): void {
  const roles = isEmpty(lines)
    ? []
    : [...lines, `a workspace package declares one of the roles of harness/lib/roles.ts (${ROLE_WORDS.join(', ')})`];
  const named = [...caseLine(refused.unread, 'cannot be read'), ...caseLine(refused.undeclared, 'hold an aricanga that is no object')];
  if (!isEmpty(named)) {
    throw new ConfigError([...named, "each refusal is this one's cause", ...roles].join('; '), {
      cause: new AggregateError(
        [...refused.unread, ...refused.undeclared].map((entry) => entry.reason),
        'each manifest refused',
      ),
    });
  }
  if (!isEmpty(roles)) {
    throw new PopulationError(roles.join('; '));
  }
}

/**
 * Every manifest of a population read at one moment, the root's and each member's, and the members
 * they declare; one refusal names each manifest refused, by its case, and each role refused, at once.
 *
 * @param {readonly MemberDir[]} dirs - The members' directories.
 * @param {(listed: string) => Promise<string>} read - Reads a listed file's text.
 * @returns {Promise<Manifests>} The root's manifest and the members.
 */
async function manifestsOf(dirs: readonly MemberDir[], read: (listed: string) => Promise<string>): Promise<Manifests> {
  const rootReading = rootRead(read);
  const memberReads = Promise.all(
    dirs.map(async (dir): Promise<MemberRead> => {
      const ended = await memberRead(dir, read);
      return ended;
    }),
  );
  const root = await rootReading;
  const reads = await memberReads;
  const declared = reads.flatMap((entry) => (entry.kind === 'read' ? [declaredBy(entry.dir, entry.manifest)] : []));
  const members = declared.flatMap((entry) => (entry.kind === 'member' ? [entry.member] : []));
  refuseAll(
    {
      undeclared: reads.flatMap((entry) => (entry.kind === 'undeclared' ? [entry.refused] : [])),
      unread: [...root.refused, ...reads.flatMap((entry) => (entry.kind === 'unread' ? [entry.refused] : []))],
    },
    declared.flatMap((entry) => (entry.kind === 'refused' ? [entry.line] : [])),
  );
  return { members, rootManifest: present(root.fields, 'the root manifest') };
}

export { manifestsOf };
export type { Fields };
