import type { Site } from '@mechane/checks-kernel';
import { inScope, lineAt } from '@mechane/modules';
import type { NormalizerScope, ParsedSource } from '@mechane/modules';
import { Normalizer } from '@mechane/rule-shapes';
import { blankLineGaps } from './blank-line-gaps.ts';

/** What each site asks for. */
const BLANK_LINE_MESSAGE =
  'Set the statement apart from its neighbor with a blank line, such as `return order;` below an empty line';

/** Every TypeScript file of the members, and the files whose statements the normalizer spaces. */
type BlankLineSitesInput = { readonly sources: ReadonlyArray<ParsedSource>; readonly scope: NormalizerScope };

/** Each line the blank-lines normalizer puts a blank line above, as the check counts it. */
export function blankLineSites({ sources, scope }: BlankLineSitesInput): ReadonlyArray<Site> {
  /** A file's sites, one at each gap. */
  const fileSites: (source: ParsedSource) => ReadonlyArray<Site> = (source) => {
    /** The site of a gap. */
    const gapSite: (offset: number) => Site = (offset) => ({
      rule: Normalizer.BlankLines,
      file: source.path,
      line: lineAt({ text: source.text, offset }),
      message: BLANK_LINE_MESSAGE,
    });

    return blankLineGaps({ source }).map(gapSite);
  };

  return sources.filter(({ path }) => inScope({ path, scope })).flatMap(fileSites);
}
