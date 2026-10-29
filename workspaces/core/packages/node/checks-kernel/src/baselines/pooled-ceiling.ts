import { BaselineHold } from '@mechane/rule-shapes';
import { CONTRACTS } from '@mechane/rules';
import { Number, Option, Record } from 'effect';
import type { SiteCounts } from '../types.ts';

/** How the checks hold each ratchet's baseline to the merge base's, as the registry's `rule-registry` entry sets it. */
const BASELINE_HOLD: BaselineHold = CONTRACTS['rule-registry'].values.baselineHold;

/** A ratchet's ceiling by file, the pools of files that declaration moves join, and the counts to hold. */
type PooledCeilingInput = {
  readonly ceiling: SiteCounts;
  readonly pools: ReadonlyArray<ReadonlySet<string>>;
  readonly counts: SiteCounts;
};

type PoolTotalInput = { readonly counts: SiteCounts; readonly pool: ReadonlySet<string> };

/**
 * The ceiling with each pool held in total: when a pool's counts stay within the sum of its files' ceilings, each of
 * its files may hold its count. A pool above that sum keeps each file's own ceiling. While the registry holds totals,
 * every file of the ceiling and the counts is one more pool, so a split or a moved function passes wherever it lands.
 */
export function pooledCeiling({ ceiling, pools, counts }: PooledCeilingInput): SiteCounts {
  const heldPools: ReadonlyArray<ReadonlySet<string>> = (() => {
    if (BASELINE_HOLD === BaselineHold.Total) {
      return [...pools, new Set([...Record.keys(ceiling), ...Record.keys(counts)])];
    }

    return pools;
  })();

  const isWithin: (pool: ReadonlySet<string>) => boolean = (pool) =>
    poolTotal({ counts, pool }) <= poolTotal({ counts: ceiling, pool });

  const pooled: ReadonlySet<string> = new Set(heldPools.filter(isWithin).flatMap((pool) => [...pool]));
  const isUnpooled: (entry: readonly [file: string, count: number]) => boolean = ([file]) => !pooled.has(file);

  return Record.fromEntries([
    ...Record.toEntries(ceiling).filter(isUnpooled),
    ...Record.toEntries(counts).filter(([file]) => pooled.has(file)),
  ]);
}

/** The sum of the counts of a pool's files, where a file the counts do not list holds none. */
function poolTotal({ counts, pool }: PoolTotalInput): number {
  const fileCount: (file: string) => number = (file) => Option.getOrElse(Record.get(counts, file), () => 0);

  const fileCounts = [...pool].map(fileCount);

  return Number.sumAll(fileCounts);
}
