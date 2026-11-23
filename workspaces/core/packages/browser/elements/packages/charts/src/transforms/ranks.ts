import { finiteOrNull, hasDistinctIds, invalid, noteNumber } from './values.ts';
import type { TransformOk, TransformResult } from './values.ts';

/** Which value ranks first. */
export type RankOrder = 'descending' | 'ascending';

/** One thing ranked at every stage, such as a model across evaluation rounds. */
export type RankedItem = {
  readonly id: string;
  /** The value at each stage, keyed by stage id. A missing key or null means the item has no value there. */
  readonly values: Readonly<Record<string, number | null>>;
};

/** An item's place at one stage; null where it had no value. */
export type StageRank = { readonly stageId: string; readonly rank: number | null; readonly value: number | null };

export type RankSeriesResult = TransformResult<{
  /** The items in their supplied order, each with one rank per stage in the order of `stages`. */
  readonly items: ReadonlyArray<{ readonly id: string; readonly ranks: ReadonlyArray<StageRank> }>;
  readonly order: RankOrder;
  readonly stageCount: number;
}>;

/**
 * Ranks at each stage for a bump chart: items with a value are sorted and numbered from 1, and an item without one has
 * no rank there. The order is highest first by default (`order: 'ascending'` puts the lowest first, as for a loss).
 * Equal values are not given equal ranks: the item that comes first in `items` takes the better rank, so the order of
 * `items` breaks ties.
 */
export function rankSeries({
  items,
  stages,
  order = 'descending',
}: {
  readonly items: ReadonlyArray<RankedItem>;
  /** The stage ids, in the order the chart draws them. */
  readonly stages: ReadonlyArray<string>;
  readonly order?: RankOrder | undefined;
}): RankSeriesResult {
  if (!hasDistinctIds(items.map((item) => item.id))) {
    return invalid('Every item must have a distinct id.');
  }

  if (!hasDistinctIds(stages)) {
    return invalid('Every stage must have a distinct id.');
  }

  const direction = order === 'descending' ? -1 : 1;

  const ranksByStage = new Map(
    stages.map((stageId) => {
      const ranked = items
        .flatMap((item) => {
          const value = finiteOrNull(item.values[stageId]);

          return value === null ? [] : [{ id: item.id, value }];
        })
        .toSorted((left, right) => direction * (left.value - right.value));

      return [stageId, new Map(ranked.map((entry, index) => [entry.id, index + 1]))] as const;
    }),
  );

  return {
    kind: 'ok',
    items: items.map((item) => ({
      id: item.id,
      ranks: stages.map((stageId) => ({
        stageId,
        rank: ranksByStage.get(stageId)?.get(item.id) ?? null,
        value: finiteOrNull(item.values[stageId]),
      })),
    })),
    order,
    stageCount: stages.length,
  };
}

const orderNotes: Readonly<Record<RankOrder, string>> = { descending: 'highest first', ascending: 'lowest first' };

/**
 * The footnote for `rankSeries`, as in "Ranked by value at each of 6 stages, highest first; ties keep the listed
 * order."
 */
export function describeRanks({
  result,
  locale,
}: {
  readonly result: TransformOk<RankSeriesResult>;
  readonly locale: string;
}): string {
  const stages = noteNumber(result.stageCount, locale);

  return `Ranked by value at each of ${stages} stages, ${orderNotes[result.order]}; ties keep the listed order.`;
}
