import { writeDiagnostic } from '@mechane/program';
import { Array, Effect, Option, Record } from 'effect';
import { CHECKS_PROGRAM } from '../constants.ts';
import type { InputUnreadable } from '../errors.ts';
import type { Baseline } from '../schemas.ts';
import type { Finding, Ratchet, Site } from '../types.ts';
import { baselinePath } from './baseline-path.ts';
import { fileFindings } from './file-findings.ts';
import { readBaseline } from './read-baseline.ts';
import { scopedFiles } from './scoped-files.ts';
import { siteCounts } from './site-counts.ts';
import { siteFinding } from './site-finding.ts';

/** The sites to hold, the ratchets that hold some of them, the proposed rules, and the files they are held in. */
type HeldFindingsInput = {
  readonly sites: ReadonlyArray<Site>;
  readonly ratchets: ReadonlyArray<Ratchet>;
  /** The keys of the rules whose sites only `rules:measure` counts. */
  readonly proposed: ReadonlySet<string>;
  /** The files a command checked; absent when it checked every file, so every entry of a baseline is held. */
  readonly scope: Option.Option<ReadonlySet<string>>;
};

type RatchetFindingsInput = {
  readonly ratchet: Ratchet;
  /** The ratchet's baseline; absent before its first is written. */
  readonly baseline: Option.Option<Baseline>;
  readonly sites: ReadonlyArray<Site>;
  /** The files a command checked; absent when it checked every file. */
  readonly scope: Option.Option<ReadonlySet<string>>;
};

/**
 * Holds each ratchet's sites to its baseline in the files of `scope`: a file with more sites than its count fails, and
 * so does one with fewer. A proposed rule's sites are left out, and every other site is an enforced rule's finding.
 */
export const heldFindings = Effect.fn('heldFindings')(function* ({
  sites,
  ratchets,
  proposed,
  scope,
}: HeldFindingsInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const held = new Set(ratchets.map(({ rule }) => rule));
  const baselines = yield* Effect.forEach(ratchets, ({ rule }) => readBaseline({ rule }), { concurrency: 1 });

  /** Whether an enforced rule found the site: no ratchet holds its rule and the rule is not proposed. */
  const isEnforced: (site: Site) => boolean = ({ rule }) => !held.has(rule) && !proposed.has(rule);

  return [
    ...sites.filter(isEnforced).map((site) => siteFinding({ site })),
    ...Array.zip(ratchets, baselines).flatMap(([ratchet, baseline]) =>
      ratchetFindings({ ratchet, baseline, sites, scope }),
    ),
  ];
});

/**
 * One ratchet's findings in `scope`, after writing its total to standard error. A ratchet without a baseline, or with
 * an empty one, has one finding that says what to do.
 */
function ratchetFindings({ ratchet, baseline, sites, scope }: RatchetFindingsInput): ReadonlyArray<Finding> {
  const { rule, standard, phase } = ratchet;
  const location = baselinePath({ rule });

  if (Option.isNone(baseline)) {
    return [
      { check: rule, location, message: `Write this ratchet's baseline, such as \`mise run fix\` does (${standard})` },
    ];
  }

  if (Record.isEmptyRecord(baseline.value)) {
    return [
      {
        check: rule,
        location,
        message: `Set the status of ${rule} to enforced, such as \`status: RuleStatus.Enforced\`, since a baseline never empties (${standard})`,
      },
    ];
  }

  const own = sites.filter((site) => site.rule === rule);
  const found = siteCounts({ sites: own });

  writeDiagnostic({
    program: CHECKS_PROGRAM,
    line: `ratchet ${rule} (${standard}, swept in phase ${phase}): total ${own.length}, files ${Record.size(found)}`,
  });

  return scopedFiles({ found, allowed: baseline.value, scope }).flatMap((file) =>
    fileFindings({ ratchet, file, found, allowed: baseline.value, sites: own }),
  );
}
