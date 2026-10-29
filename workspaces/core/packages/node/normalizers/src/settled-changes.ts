import type { FileChange, InputUnreadable } from '@mechane/checks-kernel';
import type { NormalizerScope, ParsedSource } from '@mechane/modules';
import type { Normalizer } from '@mechane/rule-shapes';
import { Effect, Option } from 'effect';
import { changedSources } from './changed-sources.ts';
import { roundChanges } from './round-changes.ts';

/**
 * A normalizer, every parsed file, the entries the manifests export, every member's source roots, and the files it
 * rewrites.
 */
type SettledChangesInput = {
  readonly normalizer: Normalizer;
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly entries: ReadonlyMap<string, string>;
  readonly roots: ReadonlyArray<string>;
  readonly scope: NormalizerScope;
};

/** The files once the normalizer settles: each round's changes, parsed again, are the next round's files. */
const settledSources = Effect.fn('settledSources')(function* ({
  normalizer,
  sources,
  entries,
  roots,
  scope,
}: SettledChangesInput): Effect.fn.Return<ReadonlyArray<ParsedSource>, InputUnreadable> {
  let current = sources;
  let changes = yield* roundChanges({ normalizer, sources: current, entries, roots, scope });

  while (changes.length > 0) {
    current = changedSources({ sources: current, changes });
    changes = yield* roundChanges({ normalizer, sources: current, entries, roots, scope });
  }

  return current;
});

/**
 * What a normalizer changes in the files by the time it settles. It runs round after round in memory, each over the
 * files the last one left, until a round changes nothing. Each change holds a file's last text, or none for a file the
 * normalizer deletes.
 */
export const settledChanges = Effect.fn('settledChanges')(function* ({
  normalizer,
  sources,
  entries,
  roots,
  scope,
}: SettledChangesInput): Effect.fn.Return<ReadonlyArray<FileChange>, InputUnreadable> {
  const settled = yield* settledSources({ normalizer, sources, entries, roots, scope });
  const before = new Map(sources.map(({ path, text }) => [path, text]));
  const kept: ReadonlySet<string> = new Set(settled.map(({ path }) => path));

  /** Whether the normalizer changed the file's text. */
  const isChanged: (source: ParsedSource) => boolean = ({ path, text }) => before.get(path) !== text;
  /** The change that writes a file's last text. */
  const written: (source: ParsedSource) => FileChange = ({ path, text }) => ({ path, text: Option.some(text) });
  /** Whether the normalizer kept the file. */
  const isDeleted: (source: ParsedSource) => boolean = ({ path }) => !kept.has(path);
  /** The change that deletes a file. */
  const deleted: (source: ParsedSource) => FileChange = ({ path }) => ({ path, text: Option.none() });

  return [...settled.filter(isChanged).map(written), ...sources.filter(isDeleted).map(deleted)];
});
