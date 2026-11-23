import type { ReactNode } from 'react';
import type { ValueFormat } from '../figure/figure-format.ts';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import type { HeatmapScale } from './heatmap-scale.ts';
import { MatrixFigure } from './matrix-figure.tsx';
import type { MatrixAxisItem, MatrixCell, MatrixCellRangeProps, MatrixCellValuesProps } from './matrix-types.ts';

export type { MatrixAxisItem, MatrixCell } from './matrix-types.ts';

export type MatrixProps = FigureProps &
  FigureSelectionProps &
  MatrixCellRangeProps &
  MatrixCellValuesProps &
  HeatmapScale & {
    readonly rows: ReadonlyArray<MatrixAxisItem>;
    readonly columns: ReadonlyArray<MatrixAxisItem>;
    readonly cells: ReadonlyArray<MatrixCell>;
    /** What the color measures, with its unit and any normalization the application applied. */
    readonly valueLabel: string;
    readonly valueFormat: ValueFormat;
    /**
     * The values variant draws square cells with short values for exact comparison. The strip variant draws compact
     * intensity rows that fill the width, such as months across categories. Absent means values.
     */
    readonly variant?: 'values' | 'strip' | undefined;
  };

/**
 * Supplied values at explicit row and column identities, colored on a declared domain: attention weights, a metric by
 * model and benchmark, monthly shares by category. A reader steps through cells with the arrow keys, marks a block with
 * Shift and the arrows or a drag, and copies it as tab-separated exact values. Masked, missing and out-of-domain cells
 * stay distinct from zero, and a preset such as ConfusionMatrix suits a matrix with a fixed meaning.
 */
export function Matrix({
  variant = 'values',
  emptyLabel = 'No matrix values were supplied.',
  ...props
}: MatrixProps): ReactNode {
  return <MatrixFigure {...props} variant={variant} emptyLabel={emptyLabel} />;
}
