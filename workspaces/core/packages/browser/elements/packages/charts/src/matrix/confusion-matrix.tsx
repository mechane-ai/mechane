import type { ReactNode } from 'react';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { sum } from '../transforms/values.ts';
import { MatrixFigure } from './matrix-figure.tsx';
import { denseProblem, denseValue } from './matrix-presets.ts';
import type { MatrixPresetProps } from './matrix-presets.ts';
import { matrixCellId } from './matrix-types.ts';
import type { MatrixAxisItem, MatrixCell, MatrixCellValuesProps } from './matrix-types.ts';

/** A class a classifier can predict. */
export type ConfusionClass = { readonly id: string; readonly label: string };

export type ConfusionMatrixProps = MatrixPresetProps &
  MatrixCellValuesProps & {
    /** The classes, in the order both axes list them. */
    readonly classes: ReadonlyArray<ConfusionClass>;
    /** Example counts: one line per actual class, one count per predicted class, both in `classes` order. */
    readonly counts: ReadonlyArray<ReadonlyArray<number>>;
    /**
     * A value of `none` colors each cell by its count. A value of `row` colors it by its share of the actual class, the
     * row's count divided by the row's total, and says so in the legend. Absent means none.
     */
    readonly normalize?: 'none' | 'row' | undefined;
    /** What one count is: "Examples", "Images". Absent means examples. */
    readonly valueLabel?: string | undefined;
    /** How a count is written. Absent writes whole numbers. */
    readonly valueFormat?: ValueFormat | undefined;
    /** How a share of the actual class is written. Absent writes a percentage with one decimal. */
    readonly shareFormat?: ValueFormat | undefined;
  };

/** The largest number of classes. Each side of the matrix holds every class. */
export const confusionMatrixLimits = { classes: 64 } as const;

const countFormat = { maximumFractionDigits: 0 } as const;
const percentFormat = { style: 'percent', maximumFractionDigits: 1 } as const;

function countsProblem(counts: ReadonlyArray<ReadonlyArray<number>>): string | undefined {
  const isCounted = counts.every((line) => line.every((count) => Number.isSafeInteger(count) && count >= 0));

  return isCounted ? undefined : 'Confusion counts must be whole numbers of zero or more.';
}

/**
 * A classifier's counts of actual against predicted class: rows are the actual class, columns the predicted one, and
 * the outlined diagonal holds the correct predictions. Lightness shows the count, or each count's share of its actual
 * class with `normalize="row"`. The application supplies the counts; the chart only divides a row by its own total.
 */
export function ConfusionMatrix(props: ConfusionMatrixProps): ReactNode {
  const {
    classes,
    counts,
    normalize = 'none',
    valueLabel = 'Examples',
    valueFormat = countFormat,
    shareFormat = percentFormat,
    emptyLabel = 'No classes were supplied.',
    ...figure
  } = props;

  const { locale } = figure;
  const isShare = normalize === 'row';

  const problem =
    denseProblem({
      rows: classes,
      columns: classes,
      values: counts,
      noun: 'classes',
      limit: confusionMatrixLimits.classes,
    }) ?? countsProblem(counts);

  const totals = classes.map((_, row) => sum(counts[row] ?? []));

  const entries = classes.flatMap((actual, row) =>
    classes.map((predicted, column) => {
      const count = denseValue(counts, row, column) ?? 0;
      const total = totals[row] ?? 0;
      const id = matrixCellId(actual.id, predicted.id);
      const share = total === 0 ? null : count / total;

      const cell: MatrixCell =
        isShare && share === null
          ? {
              id,
              rowId: actual.id,
              columnId: predicted.id,
              kind: 'missing',
              reason: `No examples of actual ${actual.label}`,
            }
          : { id, rowId: actual.id, columnId: predicted.id, kind: 'value', value: isShare ? (share ?? 0) : count };

      return { cell, count, share, actual };
    }),
  );

  const byId = new Map(entries.map((entry) => [entry.cell.id, entry]));
  const largest = Math.max(1, ...entries.map((entry) => entry.count));

  function valueText(cell: MatrixCell | undefined): string {
    const entry = cell === undefined ? undefined : byId.get(cell.id);

    if (entry === undefined) {
      return 'Not supplied';
    }

    const count = formatValue({ value: entry.count, locale, format: valueFormat });
    const share = formatValue({ value: entry.share, locale, format: shareFormat });

    return entry.share === null ? count : `${count} (${share} of actual ${entry.actual.label})`;
  }

  return (
    <MatrixFigure
      {...figure}
      emptyLabel={emptyLabel}
      problem={problem}
      rows={classes}
      columns={classes}
      cells={entries.map((entry) => entry.cell)}
      domain={isShare ? [0, 1] : [0, largest]}
      palette="sequential"
      valueFormat={isShare ? shareFormat : valueFormat}
      valueLabel={
        isShare
          ? `Share of the actual class: ${valueLabel.toLowerCase()} in a row divided by the row total`
          : valueLabel
      }
      variant="values"
      rowTitle="Actual"
      columnTitle="Predicted"
      rowNoun="actual class"
      columnNoun="predicted class"
      marking={(row: MatrixAxisItem, column: MatrixAxisItem) => (row.id === column.id ? 'outlined' : undefined)}
      cellLabel={(row, column) => `Actual ${row.label}, predicted ${column.label}`}
      valueText={valueText}
      copyText={(cell) => (cell === undefined ? '' : String(byId.get(cell.id)?.count ?? ''))}
      notes={['Outlined: actual and predicted agree']}
    />
  );
}
