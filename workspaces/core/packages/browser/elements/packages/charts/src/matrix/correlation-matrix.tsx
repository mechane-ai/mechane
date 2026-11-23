import type { ReactNode } from 'react';
import type { ValueFormat } from '../figure/figure-format.ts';
import { MatrixFigure } from './matrix-figure.tsx';
import { denseProblem, denseValue } from './matrix-presets.ts';
import type { MatrixPresetProps } from './matrix-presets.ts';
import { matrixCellId } from './matrix-types.ts';
import type { MatrixAxisItem, MatrixCell, MatrixCellValuesProps } from './matrix-types.ts';

/** A variable whose pairwise correlations the matrix shows. */
export type CorrelationVariable = { readonly id: string; readonly label: string };

export type CorrelationMatrixProps = MatrixPresetProps &
  MatrixCellValuesProps & {
    /** The variables, in the order both axes list them. */
    readonly variables: ReadonlyArray<CorrelationVariable>;
    /**
     * Supplied coefficients in [-1, 1]: one line per variable, one value per variable, in `variables` order. The table
     * must be symmetric. Null marks a pair that was not computed.
     */
    readonly coefficients: ReadonlyArray<ReadonlyArray<number | null>>;
    /** `lower` draws each pair once, below the diagonal. Absent means full. */
    readonly triangle?: 'full' | 'lower' | undefined;
    /** What the coefficient is: "Pearson correlation", "Spearman rank correlation". */
    readonly valueLabel?: string | undefined;
    /** How a coefficient is written. Absent writes two decimals. */
    readonly valueFormat?: ValueFormat | undefined;
  };

/** The largest number of variables. */
export const correlationMatrixLimits = { variables: 64 } as const;

const coefficientFormat = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

function coefficientProblem(coefficients: ReadonlyArray<ReadonlyArray<number | null>>): string | undefined {
  const values = coefficients.flat();

  if (values.some((value) => value !== null && !(value >= -1 && value <= 1))) {
    return 'Correlation coefficients must lie between -1 and 1. Use null for a pair that was not computed.';
  }

  const isSymmetric = coefficients.every((line, row) =>
    line.every((value, column) => value === denseValue(coefficients, column, row)),
  );

  return isSymmetric ? undefined : 'A correlation matrix must be symmetric: each pair needs the same value both ways.';
}

/**
 * Supplied correlation coefficients between variables, such as features, probes or metrics, on a diverging palette
 * fixed at -1 to 1 with zero neutral. The diagonal is drawn in gray as context, and `triangle="lower"` shows each pair
 * once. Asymmetric or out-of-range input is refused; the application computes the coefficients.
 */
export function CorrelationMatrix(props: CorrelationMatrixProps): ReactNode {
  const {
    variables,
    coefficients,
    triangle = 'full',
    valueLabel = 'Correlation coefficient',
    valueFormat = coefficientFormat,
    emptyLabel = 'No variables were supplied.',
    ...figure
  } = props;

  const problem =
    denseProblem({
      rows: variables,
      columns: variables,
      values: coefficients,
      noun: 'variables',
      limit: correlationMatrixLimits.variables,
    }) ?? coefficientProblem(coefficients);

  const order = new Map(variables.map((variable, index) => [variable.id, index]));

  const cells = variables.flatMap((rowVariable, row) =>
    variables.map((columnVariable, column): MatrixCell => {
      const value = denseValue(coefficients, row, column);

      const coordinate = {
        id: matrixCellId(rowVariable.id, columnVariable.id),
        rowId: rowVariable.id,
        columnId: columnVariable.id,
      };

      return value === null
        ? { ...coordinate, kind: 'missing', reason: 'Not computed' }
        : { ...coordinate, kind: 'value', value };
    }),
  );

  function marking(row: MatrixAxisItem, column: MatrixAxisItem): 'hidden' | 'context' | undefined {
    const rowIndex = order.get(row.id) ?? 0;
    const columnIndex = order.get(column.id) ?? 0;

    if (rowIndex === columnIndex) {
      return 'context';
    }

    return triangle === 'lower' && columnIndex > rowIndex ? 'hidden' : undefined;
  }

  return (
    <MatrixFigure
      {...figure}
      emptyLabel={emptyLabel}
      problem={problem}
      rows={variables}
      columns={variables}
      cells={cells}
      domain={[-1, 1]}
      palette="diverging"
      valueFormat={valueFormat}
      valueLabel={valueLabel}
      variant="values"
      marking={marking}
      cellLabel={(row, column) => `${row.label} and ${column.label}`}
      notes={['Gray diagonal: each variable with itself']}
    />
  );
}
