/**
 * The declaration TypeScript looks for beside a file it does not load itself, by the rule it reads it by
 * (`allowArbitraryExtensions`): x.d.css.ts beside x.css, x.d.ts beside x when x has no extension. The
 * session's declaration rule (`virtual-files.ts`) and the whole chain's forms (`chain-forms.ts`) read it.
 */

import nodePath from 'node:path';

/** The declaration TypeScript looks for beside a file it does not load itself: x.css is declared by x.d.css.ts. */
const DECLARATION = /^(?<stem>.+)\.d\.(?<extension>[^./]+)\.ts$/u;

/** The declaration of a file with no extension: x is declared by x.d.ts. */
const BARE_DECLARATION = /^(?<stem>[^.]+)\.d\.ts$/u;

/**
 * The file a declaration path declares by the rule TypeScript reads it by (`allowArbitraryExtensions`):
 * x.css for x.d.css.ts, x for x.d.ts when x has no extension; none for any other path.
 *
 * @param {string} name - A path.
 * @returns {string | undefined} The file it declares, or none.
 */
function declaredFile(name: string): string | undefined {
  const base = nodePath.basename(name);
  if (DECLARATION.test(base)) {
    return nodePath.join(nodePath.dirname(name), base.replace(DECLARATION, '$<stem>.$<extension>'));
  }
  return BARE_DECLARATION.test(base) ? nodePath.join(nodePath.dirname(name), base.replace(BARE_DECLARATION, '$<stem>')) : undefined;
}

/**
 * The declaration path TypeScript looks for beside a file: the one rule `declaredFile` reads back.
 *
 * @param {string} file - A path.
 * @returns {string} The path that declares it.
 */
function declarationOf(file: string): string {
  const extension = nodePath.extname(file);
  return extension === ''
    ? `${file}.d.ts`
    : nodePath.join(nodePath.dirname(file), `${nodePath.basename(file, extension)}.d${extension}.ts`);
}

export { declarationOf, declaredFile };
