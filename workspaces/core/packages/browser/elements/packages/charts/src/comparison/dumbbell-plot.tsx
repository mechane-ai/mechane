import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { DotMark, IntervalMark } from '../plot/plot-marks.tsx';
import { outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { ComparisonFigure, comparisonRowsError, ROW_STEP } from './comparison-plot.tsx';

export type DumbbellRow = {
  readonly id: string;
  readonly label: string;
  /** The first value, such as the score before. Null where it was not measured. */
  readonly from: number | null;
  /** The second value, such as the score after. Null where it was not measured. */
  readonly to: number | null;
};

export type DumbbellPlotProps = FigureProps &
  FigureSelectionProps & {
    readonly rows: ReadonlyArray<DumbbellRow>;
    /** What the first value is: "Before fine-tuning". */
    readonly fromLabel: string;
    /** What the second value is: "After fine-tuning". */
    readonly toLabel: string;
    readonly fromTone?: ChartTone | undefined;
    readonly toTone?: ChartTone | undefined;
    /** The measured axis. Position carries the value, so it need not start at zero. */
    readonly value: PlotAxis;
    readonly height?: PlotHeight | undefined;
  };

export const dumbbellLimits = { rows: 60 } as const;

const DOT_RADIUS = 4.5;

/** The format of a difference: it always shows its sign, so a gain and a loss never read alike. */
function signedFormat(format: ValueFormat): ValueFormat {
  if (typeof format === 'function') {
    return (amount) => `${amount > 0 ? '+' : ''}${format(amount)}`;
  }

  return { ...format, signDisplay: 'exceptZero' };
}

function dumbbellInputError({
  rows,
  value,
  valueDomain,
}: Pick<DumbbellPlotProps, 'rows' | 'value'> & { readonly valueDomain: NumericDomain }): string | undefined {
  const rowsError = comparisonRowsError({ rows, value, valueDomain, rowsMax: dumbbellLimits.rows });

  if (rowsError !== undefined) {
    return rowsError;
  }

  const values = rows.flatMap((row) => [row.from, row.to]);

  if (values.some((amount) => amount !== null && outsideDomain(amount, valueDomain))) {
    return 'A value is not finite or lies outside the declared domain.';
  }

  return undefined;
}

/**
 * Two values per row joined by a segment, before and after or one condition against another, to show how far each
 * category moved. The joining segment is gray context, and the two ends are dots in two hues named in the legend. A row
 * with one end missing draws the present dot only, and the application supplies every value.
 */
export function DumbbellPlot(props: DumbbellPlotProps): ReactNode {
  const { rows, fromLabel, toLabel, fromTone = 'series1', toTone = 'series2', value } = props;
  const { selected, onSelectedChange, height = 'regular', ...figure } = props;
  const { emptyLabel = 'No values are available.', ...frame } = figure;
  const { locale } = frame;

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const valueDomain =
    value.domain ?? fitDomain({ values: rows.flatMap((row) => [row.from, row.to]), scale: value.scale });

  const inputError = dumbbellInputError({ rows, value, valueDomain });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  function text(number: number | null): string {
    return formatValue({ value: number, locale, format: value.format });
  }

  const items = rows.map((row) => {
    const change = row.from === null || row.to === null ? null : row.to - row.from;
    const difference = formatValue({ value: change, locale, format: signedFormat(value.format) });

    return {
      id: row.id,
      label: [
        row.label,
        `${fromLabel}: ${text(row.from)}`,
        `${toLabel}: ${text(row.to)}`,
        `Change: ${difference}`,
      ].join(' · '),
    };
  });

  return (
    <ComparisonFigure
      frame={frame}
      isEmpty={rows.length === 0}
      emptyLabel={emptyLabel}
      rows={rows}
      value={value}
      valueDomain={valueDomain}
      height={height}
      rowStep={ROW_STEP}
      items={items}
      legend={[
        { id: 'from', label: fromLabel, tone: fromTone },
        { id: 'to', label: toLabel, tone: toTone },
      ]}
      hasLegend
      grid="x"
      selected={selected}
      onSelectedChange={onSelectedChange}
      renderMarks={({ plot, inspected, selected: chosen }) =>
        rows.flatMap((row) => {
          const y = plot.band.center(row.id);

          if (y === undefined) {
            return [];
          }

          const state = { isInspected: row.id === inspected, isSelected: row.id === chosen };

          return [
            <g key={row.id}>
              {row.from !== null && row.to !== null && (
                <IntervalMark
                  x1={plot.value.position(row.from)}
                  x2={plot.value.position(row.to)}
                  y1={y}
                  y2={y}
                  tone="neutral"
                  emphasis="context"
                />
              )}
              {row.from !== null && (
                <DotMark x={plot.value.position(row.from)} y={y} tone={fromTone} radius={DOT_RADIUS} {...state} />
              )}
              {row.to !== null && (
                <DotMark x={plot.value.position(row.to)} y={y} tone={toTone} radius={DOT_RADIUS} {...state} />
              )}
            </g>,
          ];
        })
      }
    />
  );
}
