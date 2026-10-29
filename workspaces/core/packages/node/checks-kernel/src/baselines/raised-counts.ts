import { Array, Effect, Option, Record } from 'effect';
import { baselinePath } from '../ratchets/baseline-path.ts';
import { readBaseline } from '../ratchets/read-baseline.ts';
import type { Baseline } from '../schemas.ts';
import type { ChecksFailure, Finding, Ratchet } from '../types.ts';
import { mergeBase } from '../workspace/merge-base.ts';
import { baseBaselines } from './base-baselines.ts';
import { carriedCounts } from './carried-counts.ts';
import { declarationPools } from './moves/declaration-pools.ts';
import { renamedFiles } from './moves/renamed-files.ts';
import { pooledCeiling } from './pooled-ceiling.ts';

/** The ratchets, the branch whose merge base caps their baselines, and the variables git inherits. */
type RaisedCountsInput = {
  readonly ratchets: ReadonlyArray<Ratchet>;
  readonly baseBranch: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/** A ratchet, its baseline and the merge base's, the branch's renames, and the pools declaration moves join. */
type RaisedFilesInput = {
  readonly ratchet: Ratchet;
  /** The ratchet's baseline; absent before `mise run fix` writes it. */
  readonly current: Option.Option<Baseline>;
  /** The ratchet's baseline at the merge base; absent for a ratchet new on the branch. */
  readonly ancestor: Option.Option<Baseline>;
  readonly renames: ReadonlyMap<string, string>;
  readonly pools: ReadonlyArray<ReadonlySet<string>>;
};

/**
 * Each count a ratchet's baseline holds above the one its merge base held, carried across the branch's renames and
 * pooled across the move map's declaration moves. A baseline only shrinks, so neither an edit nor a regenerated
 * baseline admits a new site; a ratchet new on the branch has no merge base's to hold.
 */
export const raisedCounts = Effect.fn('raisedCounts')(function* ({
  ratchets,
  baseBranch,
  inherited,
}: RaisedCountsInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const base = yield* mergeBase({ baseBranch, inherited });
  const renames = yield* renamedFiles({ base, inherited });
  const pools = yield* declarationPools();
  const based = yield* baseBaselines({ base, ratchets, inherited });
  const currents = yield* Effect.forEach(ratchets, ({ rule }) => readBaseline({ rule }), { concurrency: 1 });

  /** The files whose count one ratchet's baseline raises above the merge base's. */
  const ratchetFindings: (held: readonly [Ratchet, Option.Option<Baseline>]) => ReadonlyArray<Finding> = ([
    ratchet,
    current,
  ]) => raisedFiles({ ratchet, current, ancestor: Option.fromNullishOr(based.get(ratchet.rule)), renames, pools });

  return Array.zip(ratchets, currents).flatMap(ratchetFindings);
});

/**
 * The files whose count a ratchet's baseline raises above its ancestor's, carried across `renames`, where a file the
 * ancestor does not list held none. A ratchet without either baseline raises nothing here.
 */
function raisedFiles({ ratchet, current, ancestor, renames, pools }: RaisedFilesInput): ReadonlyArray<Finding> {
  const { rule, standard } = ratchet;

  if (Option.isNone(current) || Option.isNone(ancestor)) {
    return [];
  }

  const ceiling = pooledCeiling({
    ceiling: carriedCounts({ held: ancestor.value, renames }),
    pools,
    counts: current.value,
  });

  /** A file's finding when its count passes the ceiling's, where a file the ceiling does not list held none. */
  const raisedFile: (entry: readonly [file: string, count: number]) => ReadonlyArray<Finding> = ([file, count]) => {
    const limit = Option.getOrElse(Record.get(ceiling, file), () => 0);

    if (count <= limit) {
      return [];
    }

    const message = `Fix the new sites, such as those \`git diff\` adds, since ${baselinePath({ rule })} holds ${count} where the merge base held ${limit} and a baseline only shrinks (${standard})`;

    return [{ check: rule, location: file, message }];
  };

  return Record.toEntries(current.value).flatMap(raisedFile);
}
