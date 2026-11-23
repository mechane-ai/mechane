import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { BarMark, RuleMark } from '../plot/plot-marks.tsx';
import { outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { ComparisonFigure, comparisonRowsError, ROW_STEP } from './comparison-plot.tsx';

/** A qualitative band of the axis, such as "Poor" up to 100. Each band runs from the one before it. */
export type BulletRange = { readonly upTo: number; readonly label: string };

export type BulletRow = {
  readonly id: string;
  readonly label: string;
  /** The measured amount, or null where it was not measured. */
  readonly value: number | null;
  /** The level the measure is held against, such as a service-level objective or a release bar. */
  readonly target?: number | undefined;
  /** The bands behind the bar, in increasing `upTo`. */
  readonly ranges?: ReadonlyArray<BulletRange> | undefined;
};

export type BulletBarProps = FigureProps &
  FigureSelectionProps & {
    readonly rows: ReadonlyArray<BulletRow>;
    /** The measured axis. A bar's length carries its amount, so the domain must start at zero. */
    readonly value: PlotAxis;
    readonly height?: PlotHeight | undefined;
  };

export const bulletLimits = { rows: 40, ranges: 4 } as const;

/** How much of the gray each band takes, darkest first. A band is lighter the further it runs from zero. */
const RANGE_SHADES = [34, 24, 15, 8] as const;
const BAR_SHARE = 0.38;
const TARGET_SHARE = 0.72;

const styles = stylex.create({ range: (color: string) => ({ fill: color }), pointerless: { pointerEvents: 'none' } });

function rangeColor(index: number): string {
  const share = RANGE_SHADES[index] ?? RANGE_SHADES.at(-1);

  return `color-mix(in srgb, ${colors.muted} ${share}%, ${colors.surface})`;
}

function bulletInputError({
  rows,
  value,
  valueDomain,
}: Pick<BulletBarProps, 'rows' | 'value'> & { readonly valueDomain: NumericDomain }): string | undefined {
  const rowsError = comparisonRowsError({ rows, value, valueDomain, rowsMax: bulletLimits.rows });

  if (rowsError !== undefined) {
    return rowsError;
  }

  if (valueDomain[0] !== 0) {
    return 'A bar starts at zero, so the value domain must begin at 0.';
  }

  for (const row of rows) {
    const ranges = row.ranges ?? [];
    const levels = [row.value, row.target, ...ranges.map((range) => range.upTo)];

    if (levels.some((level) => level !== null && level !== undefined && outsideDomain(level, valueDomain))) {
      return `Row ${row.id} has a value, target or range that is not finite or lies outside the declared domain.`;
    }

    if (ranges.length > bulletLimits.ranges) {
      return `Row ${row.id} has more than ${bulletLimits.ranges} ranges.`;
    }

    if (ranges.some((range, index) => range.upTo <= (ranges[index - 1]?.upTo ?? 0))) {
      return `Row ${row.id} needs ranges in strictly increasing order above zero.`;
    }
  }

  return undefined;
}

/**
 * A measured bar against a target and qualitative ranges, one per row: latency against its objective, or an eval's pass
 * rate against the release bar. The ranges are steps of gray behind the bar, the target is a tick in ink, and the bar
 * starts at zero. The application supplies every value, target and range.
 */
export function BulletBar(props: BulletBarProps): ReactNode {
  const { rows, value, selected, onSelectedChange, height = 'regular', ...figure } = props;
  const { emptyLabel = 'No measurements are available.', ...frame } = figure;
  const { locale } = frame;

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const valueDomain =
    value.domain ??
    fitDomain({
      values: rows.flatMap((row) => [row.value, row.target ?? null, ...(row.ranges ?? []).map((range) => range.upTo)]),
      isZeroBased: true,
      scale: value.scale,
    });

  const inputError = bulletInputError({ rows, value, valueDomain });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  function text(number: number | null): string {
    return formatValue({ value: number, locale, format: value.format });
  }

  const items = rows.map((row) => {
    const ranges = row.ranges ?? [];
    const holding = ranges.find((range) => row.value !== null && row.value <= range.upTo);

    const parts = [
      `Measured: ${text(row.value)}`,
      ...(row.target === undefined ? [] : [`Target: ${text(row.target)}`]),
      ...(holding === undefined ? [] : [`In range: ${holding.label}`]),
      ...ranges.map((range) => `${range.label}: up to ${text(range.upTo)}`),
    ];

    return { id: row.id, label: [row.label, ...parts].join(' · ') };
  });

  const hasTargets = rows.some((row) => row.target !== undefined);

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
        { id: 'measured', label: 'Measured', tone: 'series1' },
        ...(hasTargets ? [{ id: 'target', label: 'Target', tone: 'neutral' as const, shape: 'tick' as const }] : []),
      ]}
      hasLegend
      grid="x"
      selected={selected}
      onSelectedChange={onSelectedChange}
      renderMarks={({ plot, inspected, selected: chosen }) =>
        rows.flatMap((row) => {
          const center = plot.band.center(row.id);
          const start = plot.band.start(row.id);

          if (center === undefined || start === undefined) {
            return [];
          }

          const zero = plot.value.position(0);
          const barHeight = plot.band.bandwidth * BAR_SHARE;
          const tickHeight = (plot.band.bandwidth * TARGET_SHARE) / 2;

          return [
            <g key={row.id}>
              {(row.ranges ?? []).map((range, index) => {
                const from = plot.value.position(row.ranges?.[index - 1]?.upTo ?? 0);

                return (
                  <rect
                    key={range.upTo}
                    x={from}
                    y={start}
                    width={plot.value.position(range.upTo) - from}
                    height={plot.band.bandwidth}
                    {...stylex.props(styles.pointerless, styles.range(rangeColor(index)))}
                  />
                );
              })}
              {row.value !== null && (
                <BarMark
                  x={zero}
                  y={center - barHeight / 2}
                  width={plot.value.position(row.value) - zero}
                  height={barHeight}
                  tone="series1"
                  isInspected={row.id === inspected}
                  isSelected={row.id === chosen}
                />
              )}
              {row.target !== undefined && (
                <RuleMark
                  x1={plot.value.position(row.target)}
                  x2={plot.value.position(row.target)}
                  y1={center - tickHeight}
                  y2={center + tickHeight}
                />
              )}
            </g>,
          ];
        })
      }
    />
  );
}
