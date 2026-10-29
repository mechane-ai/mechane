import type { InputUnreadable, Site } from '@mechane/checks-kernel';
import type { NormalizerScope, ParsedSource } from '@mechane/modules';
import { Normalizer } from '@mechane/rule-shapes';
import { Array, Effect, Option } from 'effect';
import { barrelChanges } from './barrel-changes.ts';
import { changedLine } from './changed-line.ts';

/** Every TypeScript file of the members, the entries their manifests export, and the files whose barrels go. */
type BarrelSitesInput = {
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
};

/** A file, and what the normalizer leaves of each file it changes. */
type BarrelSiteInput = {
  readonly source: ParsedSource;
  /** Each changed file's text, absent for a barrel the normalizer deletes. */
  readonly changes: ReadonlyMap<string, Option.Option<string>>;
};

/** The example of an import from a declaring file that each barrel site gives. */
const DIRECT_IMPORT = "import { readDrone } from './read-drone.ts'";

/**
 * Each file the barrel normalizer rewrites, as the check counts it. A barrel it deletes counts once, and so does a file
 * that takes names through a barrel or its own library's entry, at its first changed line.
 */
export const barrelSites = Effect.fn('barrelSites')(function* ({
  sources,
  entries,
  scope,
}: BarrelSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const rewrites = yield* barrelChanges({ sources, entries, scope });
  const changes = new Map(rewrites.map(({ path, text }) => [path, text]));

  return Array.getSomes(sources.map((source) => barrelSite({ source, changes })));
});

/** What the normalizer does to a file: delete it as a barrel, point its statements at declaring files, or none. */
function barrelSite({ source, changes }: BarrelSiteInput): Option.Option<Site> {
  const change = Option.fromNullishOr(changes.get(source.path));

  if (Option.isNone(change)) {
    return Option.none();
  }

  if (Option.isNone(change.value)) {
    return Option.some({
      rule: Normalizer.Barrels,
      file: source.path,
      line: 1,
      message: `Delete the barrel, and import each name from the file that declares it, such as \`${DIRECT_IMPORT}\``,
    });
  }

  return Option.some({
    rule: Normalizer.Barrels,
    file: source.path,
    line: changedLine({ before: source.text, after: change.value.value }),
    message: `Import each name from the file that declares it, not through a barrel, such as \`${DIRECT_IMPORT}\``,
  });
}
