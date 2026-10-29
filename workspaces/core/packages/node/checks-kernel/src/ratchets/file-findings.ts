import { Option, Record } from 'effect';
import type { Finding, Ratchet, Site, SiteCounts } from '../types.ts';
import { siteFinding } from './site-finding.ts';

/** A ratchet, one file, the sites found and the counts its baseline allows by file, and the ratchet's sites. */
type FileFindingsInput = {
  readonly ratchet: Ratchet;
  readonly file: string;
  readonly found: SiteCounts;
  readonly allowed: SiteCounts;
  readonly sites: ReadonlyArray<Site>;
};

/** A file's findings against its count: each of its sites and a summary when it holds more, a summary when fewer. */
export function fileFindings({ ratchet, file, found, allowed, sites }: FileFindingsInput): ReadonlyArray<Finding> {
  const { rule, standard } = ratchet;
  const count = Option.getOrElse(Record.get(found, file), () => 0);
  const limit = Option.getOrElse(Record.get(allowed, file), () => 0);

  if (count > limit) {
    const message = `Fix the new sites above, such as those \`git diff\` adds, since the rule finds ${count} where its baseline holds ${limit} and a baseline only shrinks (${standard})`;

    return [
      ...sites.filter((site) => site.file === file).map((site) => siteFinding({ site })),
      { check: rule, location: file, message },
    ];
  }

  if (count < limit) {
    const message = `Lower the baseline, such as \`mise run fix\` does, since the rule finds ${count} where it holds ${limit} (${standard})`;

    return [{ check: rule, location: file, message }];
  }

  return [];
}
