import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { Array, Effect, Option } from 'effect';
import { join } from 'node:path';
import type { FileFailed } from '../errors.ts';
import { readText } from '../files/read-text.ts';
import type { IdentifierRename, Site } from '../types.ts';

/** One identifier's rename, and the workspace's TypeScript files. */
type DeclarationSiteInput = { readonly rename: IdentifierRename; readonly files: ReadonlyArray<string> };

/**
 * Where the map's line text names the identifier in its file; none once a run renamed it, which left the file without
 * that line or moved the file away.
 */
export const declarationSite = Effect.fn('declarationSite')(function* ({
  rename,
  files,
}: DeclarationSiteInput): Effect.fn.Return<Option.Option<Site>, FileFailed> {
  const path = join(WORKSPACE_FOLDER, rename.file);

  if (!files.includes(path)) {
    return Option.none();
  }

  const lines = (yield* readText({ path })).split('\n');

  /** Where the name stands on its declaring line, by the line's text and index. */
  const lineSite: (found: readonly [string, number]) => Site = ([text, line]) => ({
    path,
    line,
    character: text.indexOf(rename.at) + rename.at.indexOf(rename.from),
  });

  return Option.map(
    Array.findFirstWithIndex(lines, (text) => text.includes(rename.at)),
    lineSite,
  );
});
