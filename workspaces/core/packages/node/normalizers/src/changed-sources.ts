import type { FileChange } from '@mechane/checks-kernel';
import { parsedText } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { Option } from 'effect';

/** The files a round read, and what it changed in them. */
type ChangedSourcesInput = {
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly changes: ReadonlyArray<FileChange>;
};

type ParsedChangeInput = { readonly change: FileChange };

/** The files after a round, in their order: each changed one parsed again in its place, and each new one last. */
export function changedSources({ sources, changes }: ChangedSourcesInput): ReadonlyArray<ParsedSource> {
  const byPath = new Map(changes.map((change) => [change.path, change]));
  const known: ReadonlySet<string> = new Set(sources.map(({ path }) => path));

  /** A file as the round leaves it: as it was, parsed again, or none once deleted. */
  const roundSource: (source: ParsedSource) => ReadonlyArray<ParsedSource> = (source) => {
    const change = Option.fromNullishOr(byPath.get(source.path));

    if (Option.isNone(change)) {
      return [source];
    }

    return parsedChange({ change: change.value });
  };

  /** Whether the round adds the file, which no file before it held. */
  const isAdded: (change: FileChange) => boolean = ({ path }) => !known.has(path);

  return [...sources.flatMap(roundSource), ...changes.filter(isAdded).flatMap((change) => parsedChange({ change }))];
}

/** A changed file parsed again; none for a file the round deletes. */
function parsedChange({ change }: ParsedChangeInput): ReadonlyArray<ParsedSource> {
  return Option.toArray(change.text).map((text) => parsedText({ path: change.path, text }));
}
