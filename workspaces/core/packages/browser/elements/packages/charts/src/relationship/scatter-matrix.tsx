import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartLegend, ChartReadout } from '../chart-frame.tsx';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartPoint } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { axisTicks, axisTitle, plotBox, plotHeights, plotMargins } from '../plot/plot-layout.ts';
import type { PlotHeight } from '../plot/plot-layout.ts';
import { DotMark } from '../plot/plot-marks.tsx';
import { PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { continuousScale } from '../plot/scale.ts';
import type { ContinuousScale } from '../plot/scale.ts';
import {
  measureInputError,
  measureItems,
  measureTable,
  measureValue,
  resolveMeasureAxes,
  useMeasureTones,
} from './measures.ts';
import type { MeasureAxis, MeasureDimension, MeasureGroup, MeasureRow } from './measures.ts';

export type ScatterMatrixProps = FigureProps &
  FigureSelectionProps & {
    /** The measures to compare, two to six. Every pair of them gets a panel. */
    readonly dimensions: ReadonlyArray<MeasureDimension>;
    /** The things measured, one dot per panel each. A row missing a value is left out of the panels that need it. */
    readonly rows: ReadonlyArray<MeasureRow>;
    /** Names the sets rows belong to. Each group takes a hue. */
    readonly groups?: ReadonlyArray<MeasureGroup> | undefined;
    /** The height of the largest panel. The matrix keeps its panels square and fits them to the width. */
    readonly height?: PlotHeight | undefined;
  };

export const scatterMatrixLimits = { dimensions: 6, rows: 500 } as const;

type Panel = {
  readonly id: string;
  readonly xAxis: MeasureAxis;
  readonly yAxis: MeasureAxis;
  readonly xScale: ContinuousScale;
  readonly yScale: ContinuousScale;
  readonly left: number;
  readonly top: number;
};

const PANEL_GAP = 18;
const NARROW_GAP = 6;
const NARROW_CELL = 110;
const NARROW_SPACING = 120;
const NARROW_LINES = 4;
const SIDE_MIN = 88;
const TICK_CHARACTER = 7;
const TICK_LABEL_GAP = 8;
const ROUGH_MARGINS = 64;
const PANEL_INSET = 6;
const PANEL_SHARE = 0.7;
const TICK_SPACING = 60;
const DOT_RADIUS = 2.5;
const FOCUS_RADIUS = 4.5;
const CURSOR_RADIUS = 8;
const TICK_INSET = 8;
const TICK_DROP = 16;
const BASELINE_SHIFT = 4;

const styles = stylex.create({
  name: {
    display: 'grid',
    alignContent: 'center',
    gap: spacing.xs,
    boxSizing: 'border-box',
    height: '100%',
    padding: spacing.xs,
    overflow: 'hidden',
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  title: { fontWeight: typography.strongWeight },
  domain: { color: colors.muted, fontVariantNumeric: 'tabular-nums' },
  narrowName: { alignContent: 'start', gap: 0, padding: 0 },
  clamped: { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: NARROW_LINES, overflow: 'hidden' },
  frame: { fill: 'none' },
  scroller: { overflowX: 'auto', minWidth: 0 },
  scrolled: (minWidth: number) => ({ minWidth }),
});

/** Every pair of a few measures as small scatter panels, the way a reader scans for what moves together. */
export function ScatterMatrix(props: ScatterMatrixProps): ReactNode {
  const { dimensions, rows, groups = [], height = 'regular', selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No rows are available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize(height);
  const readoutId = useId();
  const link = useLinkedInspection();
  const { toneOf, groupLabel, legend } = useMeasureTones(groups);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const axes = resolveMeasureAxes({ dimensions, rows });
  const inputError = measureInputError({ axes, rows, groups, limits: scatterMatrixLimits });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const isNarrow = (size.width - ROUGH_MARGINS) / axes.length < NARROW_CELL;
  const gap = isNarrow ? NARROW_GAP : PANEL_GAP;

  const ticks = axes.map((axis) => {
    const { values, labels } = axisTicks({
      axis,
      domain: axis.domain,
      length: size.width / axes.length,
      spacing: isNarrow ? NARROW_SPACING : TICK_SPACING,
      locale,
      hasTitle: true,
    });

    return values.map((value, index) => ({ value, label: labels[index] ?? '' }));
  });

  const margins = plotMargins({
    width: size.width,
    valueLabels: ticks.flatMap((own) => own.map((tick) => tick.label)),
    hasXTitle: false,
    hasYTitle: false,
  });

  const cellMin = SIDE_MIN + gap;
  const contentWidth = margins.left + margins.right + cellMin * axes.length;

  const cell = Math.max(
    cellMin,
    Math.min((size.width - margins.left - margins.right) / axes.length, plotHeights[height] * PANEL_SHARE),
  );

  const side = cell - gap;
  const frameBottom = margins.top + cell * axes.length - gap;
  const box = plotBox({ width: size.width, height: frameBottom + margins.bottom, margins });

  const placed = axes.map((axis, index) => {
    const left = margins.left + index * cell;
    const top = margins.top + index * cell;

    const xScale = continuousScale({
      type: axis.scale,
      domain: axis.domain,
      range: [left + PANEL_INSET, left + side - PANEL_INSET],
    });

    const own = ticks[index] ?? [];
    const labelWidth = Math.max(0, ...own.map((tick) => tick.label.length)) * TICK_CHARACTER;

    const closest = Math.min(
      ...own.slice(1).map((tick, at) => Math.abs(xScale.position(tick.value) - xScale.position(own[at]?.value ?? 0))),
    );

    const stride = Math.max(1, Math.ceil((labelWidth + TICK_LABEL_GAP) / closest));

    return {
      axis,
      left,
      top,
      ticks: own.filter((_, at) => at % stride === 0),
      xTicks: own
        .filter((_, at) => at % stride === 0)
        .filter(
          (tick) =>
            Math.abs(xScale.position(tick.value) - left - side / 2) + (tick.label.length * TICK_CHARACTER) / 2 <=
            (side + gap) / 2,
        ),
      xScale,
      yScale: continuousScale({
        type: axis.scale,
        domain: axis.domain,
        range: [top + side - PANEL_INSET, top + PANEL_INSET],
      }),
    };
  });

  const panels: ReadonlyArray<Panel> = placed.flatMap((below, rowIndex) =>
    placed
      .slice(0, rowIndex)
      .map((beside) => ({
        id: `${below.axis.id}:${beside.axis.id}`,
        xAxis: beside.axis,
        yAxis: below.axis,
        xScale: beside.xScale,
        yScale: below.yScale,
        left: beside.left,
        top: below.top,
      })),
  );

  function pointIn(panel: Panel, row: MeasureRow): { readonly x: number; readonly y: number } | undefined {
    const x = measureValue(row, panel.xAxis);
    const y = measureValue(row, panel.yAxis);

    return x === null || y === null ? undefined : { x: panel.xScale.position(x), y: panel.yScale.position(y) };
  }

  function valueText(axis: MeasureAxis, value: number): string {
    return formatValue({ value, locale, format: axis.format });
  }

  const items = measureItems({
    rows,
    axes,
    locale,
    groupLabel,
    consequence: 'the row is not drawn in the panels that use them.',
  });

  function locate(point: ChartPoint): string | undefined {
    const x = (point.x / point.width) * box.width;
    const y = (point.y / point.height) * box.height;
    const column = Math.floor((x - margins.left) / cell);
    const rowIndex = Math.floor((y - margins.top) / cell);
    const panel = panels.find((candidate) => candidate.id === `${axes[rowIndex]?.id}:${axes[column]?.id}`);

    const distances = rows.flatMap((row) => {
      const position = panel === undefined ? undefined : pointIn(panel, row);

      return position === undefined ? [] : [{ id: row.id, distance: (position.x - x) ** 2 + (position.y - y) ** 2 }];
    });

    return distances.toSorted((first, second) => first.distance - second.distance)[0]?.id;
  }

  return (
    <Chart
      {...link}
      items={items}
      locate={locate}
      selected={selected}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, selected: selectedId, cursor }) => {
        const focused = rows.filter((row) => row.id === inspected || row.id === selectedId);
        const cursorRow = rows.find((row) => row.id === cursor);

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            series={legend}
            seriesLegend={legend.length > 0 ? <ChartLegend items={legend} /> : undefined}
            footer={
              rows.length === 0 ? undefined : (
                <ChartReadout id={readoutId}>{inspectedLabel(items, inspected ?? selectedId)}</ChartReadout>
              )
            }
          >
            {rows.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <div {...stylex.props(styles.scroller)}>
                  <div {...stylex.props(styles.scrolled(contentWidth))}>
                    <PlotSurface
                      plotRef={size.ref}
                      box={box}
                      label={plotLabel({ title, marks: 'rows', isSelectable: onSelectedChange !== undefined })}
                      readoutId={readoutId}
                    >
                      {placed.map((entry, index) => (
                        <g key={entry.axis.id}>
                          <foreignObject x={entry.left} y={entry.top} width={side} height={side}>
                            <div {...stylex.props(styles.name, isNarrow && styles.narrowName)}>
                              <span {...stylex.props(styles.title, isNarrow && styles.clamped)}>
                                {axisTitle(entry.axis)}
                              </span>
                              <span {...stylex.props(styles.domain)}>
                                {valueText(entry.axis, entry.axis.domain[0])} –{' '}
                                {valueText(entry.axis, entry.axis.domain[1])}
                              </span>
                            </div>
                          </foreignObject>
                          {index < placed.length - 1 &&
                            entry.xTicks.map((tick) => (
                              <text
                                key={tick.value}
                                x={entry.xScale.position(tick.value)}
                                y={frameBottom + TICK_DROP}
                                textAnchor="middle"
                                {...stylex.props(chartStyles.label, chartStyles.tick)}
                              >
                                {tick.label}
                              </text>
                            ))}
                          {index > 0 &&
                            entry.ticks.map((tick) => (
                              <text
                                key={tick.value}
                                x={margins.left - TICK_INSET}
                                y={entry.yScale.position(tick.value) + BASELINE_SHIFT}
                                textAnchor="end"
                                {...stylex.props(chartStyles.label, chartStyles.tick)}
                              >
                                {tick.label}
                              </text>
                            ))}
                        </g>
                      ))}
                      {panels.map((panel) => (
                        <g key={panel.id}>
                          <rect
                            x={panel.left}
                            y={panel.top}
                            width={side}
                            height={side}
                            {...stylex.props(chartStyles.grid, styles.frame)}
                          />
                          {rows.map((row) => {
                            const position = pointIn(panel, row);

                            return position === undefined ? null : (
                              <DotMark
                                key={row.id}
                                x={position.x}
                                y={position.y}
                                tone={toneOf(row)}
                                radius={DOT_RADIUS}
                                emphasis={toneOf(row) === 'neutral' ? 'context' : 'normal'}
                              />
                            );
                          })}
                          {focused.map((row) => {
                            const position = pointIn(panel, row);

                            return position === undefined ? null : (
                              <DotMark
                                key={row.id}
                                x={position.x}
                                y={position.y}
                                tone={toneOf(row)}
                                radius={FOCUS_RADIUS}
                                isInspected={row.id === inspected}
                                isSelected={row.id === selectedId}
                              />
                            );
                          })}
                          {cursorRow !== undefined && pointIn(panel, cursorRow) !== undefined && (
                            <circle
                              cx={pointIn(panel, cursorRow)?.x}
                              cy={pointIn(panel, cursorRow)?.y}
                              r={CURSOR_RADIUS}
                              fill="none"
                              {...stylex.props(chartStyles.shapeCursor)}
                            />
                          )}
                        </g>
                      ))}
                    </PlotSurface>
                  </div>
                </div>
                <ChartData label={`${title} rows`} {...measureTable({ rows, axes, locale })} />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
