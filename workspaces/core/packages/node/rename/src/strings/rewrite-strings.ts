import { FACTORY_FOLDER } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { extname, relative } from 'node:path';
import type { FileFailed } from '../errors.ts';
import type { StringRename } from '../types.ts';
import { rewriteFile } from './rewrite-file.ts';

/** The extensions of the files the string pass rewrites, which carry wire strings that no compiler reads. */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.jsonc', '.sh', '.md']);

/** The folder of dated notes, which keep the names their day used. */
const NOTES_FOLDER = '.context/';

/**
 * A map's wire strings, the absolute path of every file of the factory, and each asset file the contract lock lists, by
 * its path from the factory's root.
 */
type RewriteStringsInput = {
  readonly renames: ReadonlyArray<StringRename>;
  readonly files: ReadonlyArray<string>;
  readonly assets: ReadonlySet<string>;
};

/** A file of the factory, by its absolute path, and the asset files the pass leaves. */
type IsRewrittenInput = { readonly path: string; readonly assets: ReadonlySet<string> };

/**
 * Rewrites the map's wire strings in every text file of the factory but the dated notes, which keep the names of their
 * day, and the installed assets, which `tenet validate` locks. In a contract only the local adaptations change, since a
 * library pins the text above them.
 */
export const rewriteStrings = Effect.fn('rewriteStrings')(function* ({
  renames,
  files,
  assets,
}: RewriteStringsInput): Effect.fn.Return<void, FileFailed> {
  const rewrittenFiles = files.filter((path) => isRewritten({ path, assets }));

  yield* Effect.forEach(rewrittenFiles, (path) => rewriteFile({ renames, path }), { discard: true, concurrency: 1 });
});

/** Whether the string pass rewrites the file: a text file outside the dated notes that no installed contract ships. */
function isRewritten({ path, assets }: IsRewrittenInput): boolean {
  const factoryPath = relative(FACTORY_FOLDER, path);

  return TEXT_EXTENSIONS.has(extname(path)) && !factoryPath.startsWith(NOTES_FOLDER) && !assets.has(factoryPath);
}
