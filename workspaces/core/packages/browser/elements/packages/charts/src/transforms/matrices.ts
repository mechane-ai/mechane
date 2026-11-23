import type { MatrixCell } from '../matrix/matrix-types.ts';
import { hasDistinctIds, invalid, leftOutNote, mean, noteNumber, sum } from './values.ts';
import type { TransformOk, TransformResult } from './values.ts';

const CORRELATION_PAIRS_MIN = 2;

/** The id of the cell at a row and a column. */
function matrixCellId({ rowId, columnId }: { readonly rowId: string; readonly columnId: string }): string {
  return [rowId, columnId].join(':');
}

export type CorrelationMatrixResult = TransformResult<{
  /** One cell per pair of columns, row by row: cells a `Matrix` takes as they are. */
  readonly cells: ReadonlyArray<MatrixCell>;
  readonly columnCount: number;
  readonly rowCount: number;
}>;

function pairedValues(
  left: ReadonlyArray<number | null>,
  right: ReadonlyArray<number | null>,
): ReadonlyArray<readonly [number, number]> {
  return left.flatMap((value, index) => {
    const other = right[index] ?? null;

    if (value === null || other === null) {
      return [];
    }

    return Number.isFinite(value) && Number.isFinite(other) ? [[value, other] as const] : [];
  });
}

/** Pearson's r of paired values, or why it is undefined. */
function pearson(pairs: ReadonlyArray<readonly [number, number]>): number | string {
  if (pairs.length < CORRELATION_PAIRS_MIN) {
    return 'Fewer than two shared observations';
  }

  const leftMean = mean(pairs.map(([value]) => value));
  const rightMean = mean(pairs.map(([, value]) => value));
  const leftSpread = sum(pairs.map(([value]) => (value - leftMean) * (value - leftMean)));
  const rightSpread = sum(pairs.map(([, value]) => (value - rightMean) * (value - rightMean)));

  if (leftSpread === 0 || rightSpread === 0) {
    return 'A column does not vary';
  }

  const covariance = sum(pairs.map(([left, right]) => (left - leftMean) * (right - rightMean)));

  return Math.max(-1, Math.min(1, covariance / Math.sqrt(leftSpread * rightSpread)));
}

/**
 * Pearson correlation coefficients between every pair of columns, from −1 (one falls as the other rises) through 0 (no
 * straight-line relation) to 1 (they rise together). Each pair uses the rows where both columns have a value
 * (pairwise-complete observations), so a missing value drops its row from its pairs and is never read as zero. A pair
 * with fewer than two shared rows, or a column that does not vary, gives a missing cell with the reason.
 */
export function correlationMatrix({
  columns,
}: {
  /** Each column's values by row, keyed by the column id; every column has the same rows in the same order. */
  readonly columns: Readonly<Record<string, ReadonlyArray<number | null>>>;
}): CorrelationMatrixResult {
  const entries = Object.entries(columns);
  const rowCount = entries[0]?.[1].length ?? 0;

  if (entries.length === 0) {
    return invalid('There are no columns to correlate.');
  }

  if (entries.some(([, values]) => values.length !== rowCount)) {
    return invalid('Every column must have the same number of rows.');
  }

  return {
    kind: 'ok',
    cells: entries.flatMap(([rowId, rowValues]) =>
      entries.map(([columnId, columnValues]): MatrixCell => {
        const value = pearson(pairedValues(rowValues, columnValues));
        const id = matrixCellId({ rowId, columnId });

        return typeof value === 'string'
          ? { id, rowId, columnId, kind: 'missing', reason: value }
          : { id, rowId, columnId, kind: 'value', value };
      }),
    ),
    columnCount: entries.length,
    rowCount,
  };
}

/**
 * The footnote for `correlationMatrix`, as in "Pearson correlation of 8 columns over 500 rows, pairwise-complete
 * observations."
 */
export function describeCorrelation({
  result,
  locale,
}: {
  readonly result: TransformOk<CorrelationMatrixResult>;
  readonly locale: string;
}): string {
  const columns = noteNumber(result.columnCount, locale);

  return `Pearson correlation of ${columns} columns over ${noteNumber(result.rowCount, locale)} rows, pairwise-complete observations.`;
}

export type ConfusionCountsResult = TransformResult<{
  readonly cells: ReadonlyArray<MatrixCell>;
  /** Examples with both an actual and a predicted class. */
  readonly counted: number;
  /** Examples missing either class. */
  readonly skipped: number;
}>;

/**
 * A confusion matrix: how many examples of each actual class (rows) received each predicted class (columns), in the
 * order of `classes`. The diagonal holds the correct predictions. An example whose actual or predicted class is null is
 * skipped and counted, and a class not in `classes` is rejected.
 */
export function confusionCounts({
  actual,
  predicted,
  classes,
}: {
  readonly actual: ReadonlyArray<string | null>;
  readonly predicted: ReadonlyArray<string | null>;
  /** The class ids, in the order rows and columns appear. */
  readonly classes: ReadonlyArray<string>;
}): ConfusionCountsResult {
  if (actual.length !== predicted.length) {
    return invalid('The actual and predicted lists must have the same length.');
  }

  if (classes.length === 0 || !hasDistinctIds(classes)) {
    return invalid('The classes must be a non-empty list of distinct ids.');
  }

  const known = new Set(classes);

  const pairs = actual.flatMap((truth, index) => {
    const guess = predicted[index] ?? null;

    return truth === null || guess === null ? [] : [{ truth, guess }];
  });

  const unknown = pairs.find((pair) => !known.has(pair.truth) || !known.has(pair.guess));

  if (unknown !== undefined) {
    return invalid(`The class ${known.has(unknown.truth) ? unknown.guess : unknown.truth} is not in the class list.`);
  }

  const groups = Map.groupBy(pairs, (pair) => `${pair.truth}\u0000${pair.guess}`);

  return {
    kind: 'ok',
    cells: classes.flatMap((rowId) =>
      classes.map((columnId): MatrixCell => ({
        id: matrixCellId({ rowId, columnId }),
        rowId,
        columnId,
        kind: 'value',
        value: groups.get(`${rowId}\u0000${columnId}`)?.length ?? 0,
      })),
    ),
    counted: pairs.length,
    skipped: actual.length - pairs.length,
  };
}

/** The footnote for `confusionCounts`, as in "Counts of 1,000 examples by actual and predicted class." */
export function describeConfusion({
  result,
  locale,
}: {
  readonly result: TransformOk<ConfusionCountsResult>;
  readonly locale: string;
}): string {
  const skipped = leftOutNote({
    count: result.skipped,
    noun: { one: 'example without a class', other: 'examples without a class' },
    reason: 'skipped',
    locale,
  });

  return `Counts of ${noteNumber(result.counted, locale)} examples by actual and predicted class.${skipped}`;
}
