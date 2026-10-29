import { Record } from 'effect';

/** A manifest before the step whole, and its two dependency lists after it. */
type ListedManifestInput = {
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly lists: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

/** A manifest with its dependency lists as the step leaves them, at their places, and without a list it empties. */
export function listedManifest({ manifest, lists }: ListedManifestInput): Readonly<Record<string, unknown>> {
  const emptied: ReadonlySet<string> = new Set(Record.keys(Record.filter(lists, (list) => Record.isEmptyRecord(list))));

  /** Whether the step keeps the key: any but a list it empties. */
  const isKept: (value: unknown, key: string) => boolean = (_value, key) => !emptied.has(key);

  return Record.filter({ ...manifest, ...lists }, isKept);
}
