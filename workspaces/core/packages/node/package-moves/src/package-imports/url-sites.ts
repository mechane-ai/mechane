import type { ParsedSource } from '@mechane/modules';
import { Option } from 'effect';
import type { LiteralSite } from './types.ts';

/** A `new URL` of a path beside the module, whose path keeps naming its file or folder after the step. */
const LOCATED_URL = /new URL\('(\.[^']*)', (import\.meta)\.url\)/dg;

/** The index of the path's group in a match of `LOCATED_URL`. */
const PATH_GROUP = 1;

/** The index of the group of `import.meta` in a match of `LOCATED_URL`, which the text of a string never parses as. */
const META_GROUP = 2;

/** A file. */
type UrlSitesInput = { readonly source: ParsedSource };

/** A file, a match of `LOCATED_URL` in its text, and the offsets where its parse finds `import.meta`. */
type MatchSiteInput = {
  readonly source: ParsedSource;
  readonly match: RegExpExecArray;
  readonly metas: ReadonlySet<number>;
};

/**
 * Each `new URL` of a relative path and `import.meta.url`, by the offsets of its path. A match inside a string, such as
 * a rule's example, holds no parsed `import.meta`, so it is none.
 */
export function urlSites({ source }: UrlSitesInput): ReadonlyArray<LiteralSite> {
  const metas: ReadonlySet<number> = new Set(source.parsed.module.importMetas.map(({ start }) => start));

  /** The site of a match, none for one inside a string. */
  const matchSites: (match: RegExpExecArray) => ReadonlyArray<LiteralSite> = (match) =>
    Option.toArray(matchSite({ source, match, metas }));

  return [...source.text.matchAll(LOCATED_URL)].flatMap(matchSites);
}

/** A match's path, where the `import.meta` it names is one the parse found. */
function matchSite({ source, match, metas }: MatchSiteInput): Option.Option<LiteralSite> {
  const indices = Option.fromNullishOr(match.indices);
  const path = Option.flatMap(indices, (groups) => Option.fromNullishOr(groups[PATH_GROUP]));

  const isParsed = Option.exists(
    Option.flatMap(indices, (groups) => Option.fromNullishOr(groups[META_GROUP])),
    ([start]) => metas.has(start),
  );

  /** The site of the path the group's offsets span. */
  const pathSite: (span: readonly [number, number]) => LiteralSite = ([start, end]) => ({
    value: source.text.slice(start, end),
    start,
    end,
    isModule: false,
  });

  return Option.map(
    Option.filter(path, () => isParsed),
    pathSite,
  );
}
