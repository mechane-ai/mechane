import type { ParsedSource, TextEdit } from '@mechane/modules';
import { moduleSites } from './module-sites.ts';
import { placedLiteral } from './placed-literal.ts';
import type { LiteralSite, SourceContext } from './types.ts';
import { urlSites } from './url-sites.ts';

/** The context of a file's rewrite, the file, and the starts of the named statements the statement rewrite takes. */
type LiteralEditsInput = {
  readonly context: SourceContext;
  readonly source: ParsedSource;
  readonly named: ReadonlySet<number>;
};

/** A relative path of a file, with its text after the step and whether it would cross members. */
type PlacedSite = { readonly site: LiteralSite; readonly value: string; readonly isCrossing: boolean };

/** A file's literal edits, and each import it could no longer name, since it would cross into another member. */
type LiteralEdits = { readonly edits: ReadonlyArray<TextEdit>; readonly crossings: ReadonlyArray<string> };

/**
 * The edits of each relative path no named statement takes: a side-effect, default or namespace import, a star
 * re-export, a dynamic import, and a `new URL` beside the module. Each keeps naming its file or folder from where the
 * file lands; an import that would cross into another member is a crossing, which a literal path cannot make.
 */
export function literalEdits({ context, source, named }: LiteralEditsInput): LiteralEdits {
  const sites = [...moduleSites({ source, named }), ...urlSites({ source })].filter(({ value }) =>
    value.startsWith('.'),
  );

  /** The relative path with its text after the step. */
  const placedSite: (site: LiteralSite) => PlacedSite = (site) => ({
    site,
    ...placedLiteral({ context, source, site }),
  });

  const placed = sites.map(placedSite);

  return {
    edits: placed
      .filter(({ site, value }) => value !== site.value)
      .map(({ site, value }) => ({ start: site.start, end: site.end, text: value })),
    crossings: placed.filter(({ isCrossing }) => isCrossing).map(({ site }) => site.value),
  };
}
