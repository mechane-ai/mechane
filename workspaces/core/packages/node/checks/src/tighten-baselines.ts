import {
  baseBaselines,
  baselinePath,
  carriedCounts,
  declarationPools,
  lintSites,
  mergeBase,
  parsedSources,
  pooledCeiling,
  ratchetRules,
  readBaseline,
  renamedFiles,
  siteCounts,
  strayBaselines,
  WORKSPACE_FOLDER,
  workspaceMembers,
  writeBaseline,
  writeChanges,
} from '@mechane/checks-kernel';
import type { Baseline, ChecksFailure, FileChange, Finding, Ratchet, Site, SiteCounts } from '@mechane/checks-kernel';
import { heldNormalizers, normalizerSites } from '@mechane/normalizers';
import { ownedSites } from '@mechane/owned-rules';
import { Effect, Option, Record } from 'effect';
import { join } from 'node:path';
import { loweredCounts } from './lowered-counts.ts';

/**
 * A ratchet, the sites the tree has, the branch's renames, the pools declaration moves join, and the baseline the merge
 * base held, if any.
 */
type TightenBaselineInput = {
  readonly ratchet: Ratchet;
  readonly sites: ReadonlyArray<Site>;
  readonly renames: ReadonlyMap<string, string>;
  readonly pools: ReadonlyArray<ReadonlySet<string>>;
  /** The ratchet's baseline at the merge base; absent for a ratchet new on the branch. */
  readonly based: Option.Option<Baseline>;
};

/** The branch whose merge base caps every baseline, and the variables git and the linters inherit. */
type TightenBaselinesInput = { readonly baseBranch: string; readonly inherited: Readonly<Record<string, string>> };

/** Writes one ratchet's tightened baseline, or refuses it when no site is left, which asks for the flip instead. */
const tightenBaseline = Effect.fn('tightenBaseline')(function* ({
  ratchet,
  sites,
  renames,
  pools,
  based,
}: TightenBaselineInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const found = siteCounts({ sites: sites.filter(({ rule }) => rule === ratchet.rule) });
  const current = yield* readBaseline({ rule: ratchet.rule });
  const held = Option.orElse(based, () => current);

  /** The ceiling a baseline sets once its counts are carried across renames and pooled across moves. */
  const ceilingOf: (baseline: Baseline) => SiteCounts = (baseline) =>
    pooledCeiling({ ceiling: carriedCounts({ held: baseline, renames }), pools, counts: found });

  const ceiling = Option.map(held, ceilingOf);

  const counts = Option.match(ceiling, {
    onNone: () => found,
    onSome: (capped) => loweredCounts({ held: capped, found }),
  });

  const path = baselinePath({ rule: ratchet.rule });

  if (Record.isEmptyRecord(counts)) {
    const message = `Set the status of ${ratchet.rule} to enforced, such as \`status: RuleStatus.Enforced\`, since no site is left and a baseline never empties (${ratchet.standard})`;

    return [{ check: ratchet.rule, location: path, message }];
  }

  yield* writeBaseline({ path: join(WORKSPACE_FOLDER, path), counts });

  return [];
});

/**
 * The tighten command: lowers each ratchet's baseline to the tree's sites, never above the merge base's count, carried
 * across renames and pooled across the move map's declaration moves. A ratchet new on the branch never rises above its
 * own baseline, and its first baseline holds the tree's counts. It refuses an empty baseline and deletes a stray one.
 */
export const tightenBaselines = Effect.fn('tightenBaselines')(function* ({
  baseBranch,
  inherited,
}: TightenBaselinesInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const members = yield* workspaceMembers();
  const sources = yield* parsedSources({ members });
  const ratchets = ratchetRules();
  const base = yield* mergeBase({ baseBranch, inherited });
  const renames = yield* renamedFiles({ base, inherited });
  const pools = yield* declarationPools();
  const based = yield* baseBaselines({ base, ratchets, inherited });
  const linted = yield* lintSites({ paths: [], inherited });
  const owned = yield* ownedSites({ sources });
  const normalized = yield* normalizerSites({ rules: heldNormalizers(), members, sources });
  const sites = [...linted, ...owned, ...normalized];

  /** Tightens one ratchet's baseline against the merge base's. */
  const tightenRatchet: (ratchet: Ratchet) => Effect.Effect<ReadonlyArray<Finding>, ChecksFailure> = (ratchet) =>
    tightenBaseline({ ratchet, sites, renames, pools, based: Option.fromNullishOr(based.get(ratchet.rule)) });

  const refusals = yield* Effect.forEach(ratchets, tightenRatchet, { concurrency: 1 });
  const strays = yield* strayBaselines({ ratchets });

  /** The change that deletes a stray baseline. */
  const deletion: (path: string) => FileChange = (path) => ({ path, text: Option.none() });

  yield* writeChanges({ changes: strays.map(deletion) });

  return refusals.flat();
});
