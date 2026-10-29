import type { FileChange, InputUnreadable } from '@mechane/checks-kernel';
import { ENTRY_FILE, exportTable, inScope } from '@mechane/modules';
import type { NormalizerScope, ParsedSource } from '@mechane/modules';
import { Array, Effect, Option } from 'effect';
import { basename } from 'node:path';
import { directImports } from './direct-imports.ts';

/**
 * Every TypeScript file of the members, the entries their manifests export, and the paths whose barrels go, every
 * barrel when they are none, all relative to the workspace.
 */
type BarrelChangesInput = {
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
};

/**
 * The barrel normalizer's changes. Every `index.ts` under the scope that no member's manifest exports goes. Each
 * statement that takes names through one takes them from their declaring files instead, as does each import of its own
 * library's entry by a file under the scope.
 */
export const barrelChanges = Effect.fn('barrelChanges')(function* ({
  sources,
  entries,
  scope,
}: BarrelChangesInput): Effect.fn.Return<ReadonlyArray<FileChange>, InputUnreadable> {
  /** Whether the file is a barrel under the scope that no manifest exports. */
  const isBarrel: (path: string) => boolean = (path) =>
    basename(path) === ENTRY_FILE && !entries.has(path) && inScope({ path, scope });

  const barrels: ReadonlySet<string> = new Set(sources.map(({ path }) => path).filter(isBarrel));
  const table = exportTable({ sources });

  /** Whether the file stays, as every file but a barrel does. */
  const isKept: (source: ParsedSource) => boolean = ({ path }) => !barrels.has(path);

  const rewritten = yield* Effect.forEach(
    sources.filter(isKept),
    (source) => directImports({ source, barrels, entries, scope, table }),
    { concurrency: 1 },
  );

  /** The change that deletes a barrel. */
  const deletion: (path: string) => FileChange = (path) => ({ path, text: Option.none() });

  return [...Array.getSomes(rewritten), ...[...barrels].map(deletion)];
});
