import { folderPrefixPath, movedPath, TRAILING_SLASH } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { posix } from 'node:path';
import { memberOf } from '../member-of.ts';
import type { LiteralSite, SourceContext } from './types.ts';

/** A relative path's text after the step, and whether it is an import that would cross into another member. */
type PlacedLiteral = { readonly value: string; readonly isCrossing: boolean };

/** The relative path of a folder's parent, which a specifier writes without `./` before it. */
const PARENT_FOLDER = '..';

/** The relative path of a file's own folder. */
const OWN_FOLDER = '.';

/** The context of a file's rewrite, the file, and one of its relative paths. */
type PlacedLiteralInput = {
  readonly context: SourceContext;
  readonly source: ParsedSource;
  readonly site: LiteralSite;
};

/** A file after the step, and a file or folder a relative path of it names after the step. */
type LiteralPathInput = { readonly importer: string; readonly target: string };

/** A relative path's text from where its file lands, naming what it named, and whether an import crosses members. */
export function placedLiteral({ context, source, site }: PlacedLiteralInput): PlacedLiteral {
  const { layout } = context;
  const named = posix.join(posix.dirname(source.path), site.value).replace(TRAILING_SLASH, '');
  const target = movedPath({ moves: layout.moves, path: named });
  const importer = movedPath({ moves: layout.moves, path: source.path });
  const isCrossing = site.isModule && memberOf({ layout, path: target }) !== memberOf({ layout, path: importer });

  if (target === named && importer === source.path) {
    return { value: site.value, isCrossing };
  }

  const value = literalPath({ importer, target });

  if (TRAILING_SLASH.test(site.value)) {
    return { value: folderPrefixPath({ folder: value }), isCrossing };
  }

  return { value, isCrossing };
}

/** A relative path from a file to a file or folder as a specifier writes it, with `./` before one below its folder. */
function literalPath({ importer, target }: LiteralPathInput): string {
  const path = posix.relative(posix.dirname(importer), target);

  if (path === '') {
    return OWN_FOLDER;
  }

  if (path === PARENT_FOLDER || path.startsWith(folderPrefixPath({ folder: PARENT_FOLDER }))) {
    return path;
  }

  return `./${path}`;
}
