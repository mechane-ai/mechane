import { Record } from 'effect';
import type { Site, SiteCounts } from '../types.ts';

type SiteCountsInput = { readonly sites: ReadonlyArray<Site> };

/** How many of `sites` each file holds. */
export function siteCounts({ sites }: SiteCountsInput): SiteCounts {
  const byFile = Map.groupBy(sites, ({ file }) => file);

  return Record.fromEntries([...byFile].map(([file, held]) => [file, held.length]));
}
