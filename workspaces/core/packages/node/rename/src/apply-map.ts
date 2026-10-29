import { contractLock, FACTORY_FOLDER, lockedAssets } from '@mechane/checks-kernel';
import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { FileStep } from './constants.ts';
import { FileFailed } from './errors.ts';
import { factoryFiles } from './files/factory-files.ts';
import { moveFiles } from './files/move-files.ts';
import { workspaceSources } from './files/workspace-sources.ts';
import { declarationSite } from './identifiers/declaration-site.ts';
import { renameIdentifiers } from './identifiers/rename-identifiers.ts';
import type { RenameMap } from './schemas.ts';
import { startLanguageServer } from './server/start-language-server.ts';
import { rewriteStrings } from './strings/rewrite-strings.ts';
import type { IdentifierRename, RenameFailure } from './types.ts';

/** A rename map. */
type ApplyMapInput = { readonly map: RenameMap };

/** The identifiers to rename through one language server, and the workspace's TypeScript files. */
type ServedRenamesInput = { readonly renames: ReadonlyArray<IdentifierRename>; readonly files: ReadonlyArray<string> };

/**
 * Applies a map's three passes in order: the identifiers through the language server while every file keeps its path,
 * then the file moves with their imports, then the wire strings. Each pass skips what it finds done, so a branch that
 * merged half of a rename runs the map again to finish it. The string pass leaves each asset file the contract lock
 * lists, and the server starts only for a rename left.
 */
export const applyMap = Effect.fn('applyMap')(function* ({
  map,
}: ApplyMapInput): Effect.fn.Return<void, RenameFailure> {
  const sources = yield* workspaceSources();

  const sites = yield* Effect.forEach(map.identifiers, (rename) => declarationSite({ rename, files: sources }), {
    concurrency: 1,
  });

  if (sites.some((site) => Option.isSome(site))) {
    yield* servedRenames({ renames: map.identifiers, files: sources });
  }

  yield* moveFiles({ moves: map.files, files: sources });

  const files = yield* factoryFiles({ folder: FACTORY_FOLDER });

  const lock = yield* contractLock().pipe(
    Effect.mapError((failure) => new FileFailed({ step: FileStep.Decode, path: failure.path, reason: failure.reason })),
  );

  const assets = lockedAssets({ lock });

  yield* rewriteStrings({ renames: map.strings, files, assets });
});

/** Renames the identifiers through one language server, which stops when the renames end. */
const servedRenames = Effect.fn('servedRenames')(function* ({
  renames,
  files,
}: ServedRenamesInput): Effect.fn.Return<void, RenameFailure, Scope.Scope> {
  yield* renameIdentifiers({ server: yield* startLanguageServer(), renames, files });
}, Effect.scoped);
