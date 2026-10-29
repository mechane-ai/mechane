import { Effect, Option } from 'effect';
import type { FileFailed, ServerExited } from '../errors.ts';
import { NothingRenamed } from '../errors.ts';
import { applyEdits } from '../server/apply-edits.ts';
import { renameAt } from '../server/rename-at.ts';
import type { IdentifierRename, LanguageServer } from '../types.ts';
import { declarationSite } from './declaration-site.ts';
import { linkedEdits } from './linked-edits.ts';
import { referenceSites } from './reference-sites.ts';

/** The language server, the identifiers to rename, and the workspace's TypeScript files. */
type RenameIdentifiersInput = {
  readonly server: LanguageServer;
  readonly renames: ReadonlyArray<IdentifierRename>;
  /** The absolute path of every TypeScript file of the workspace, where a reference may sit. */
  readonly files: ReadonlyArray<string>;
};

/** The language server, one identifier to rename, and the workspace's TypeScript files. */
type RenameIdentifierInput = {
  readonly server: LanguageServer;
  readonly rename: IdentifierRename;
  readonly files: ReadonlyArray<string>;
};

/**
 * Renames each identifier from its declaration, in the map's order. A declaration's own program finds only the
 * references inside it, so each other reference is renamed from its own program too. That rename joins when its edits
 * share one with the declaration's, such as a catalog's shorthand key that a property access names.
 */
export const renameIdentifiers = Effect.fn('renameIdentifiers')(function* ({
  server,
  renames,
  files,
}: RenameIdentifiersInput): Effect.fn.Return<void, FileFailed | NothingRenamed | ServerExited> {
  yield* Effect.forEach(renames, (rename) => renameIdentifier({ server, rename, files }), {
    discard: true,
    concurrency: 1,
  });
});

/** Renames one identifier where its declaration still stands; a run that renamed it already finds none. */
const renameIdentifier = Effect.fn('renameIdentifier')(function* ({
  server,
  rename,
  files,
}: RenameIdentifierInput): Effect.fn.Return<void, FileFailed | NothingRenamed | ServerExited> {
  const declaration = yield* declarationSite({ rename, files });

  if (Option.isNone(declaration)) {
    return;
  }

  const declared = yield* renameAt({ server, site: declaration.value, to: rename.to });

  if (Option.isNone(declared)) {
    return yield* new NothingRenamed({ name: rename.from, file: rename.file });
  }

  const sites = yield* referenceSites({ files, name: rename.from });

  const edits = yield* Effect.reduce(
    sites,
    () => declared.value,
    (accepted, site) => linkedEdits({ server, site, to: rename.to, accepted }),
  );

  yield* applyEdits({ server, edits });
});
