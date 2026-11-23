import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { accessibility } from '../../../foundations/src/accessibility.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { inspectionReadout } from '../chart-inspection.tsx';
import type { ChartInspectionRow } from '../chart-inspection.tsx';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps } from '../figure/figure-props.ts';
import { heatmapColor } from '../matrix/heatmap-scale.ts';
import { locateNearest } from '../plot/locate.ts';
import { areaPath } from '../plot/path.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { axisTicks, axisTitle, fitDomain, plotBox, plotMargins } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight, PlotTick } from '../plot/plot-layout.ts';
import { LabelMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { continuousScale, outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { gutterChars, truncateLabel } from './end-labels.tsx';

export type HorizonPoint = { readonly x: number; readonly y: number | null };

export type HorizonSeries = {
  readonly id: string;
  readonly label: string;
  /** Observations in increasing `x`. Rows share the chart's x axis, but need not share their positions. */
  readonly points: ReadonlyArray<HorizonPoint>;
};

export type HorizonBands = 2 | 3 | 4;

export type HorizonChartProps = FigureProps & {
  readonly series: ReadonlyArray<HorizonSeries>;
  readonly x: PlotAxis;
  /** The values every row folds, on one linear domain that holds zero. The domain is required, so rows compare. */
  readonly value: PlotAxis & { readonly domain: NumericDomain };
  /** How many layers each row folds its values into. */
  readonly bands: HorizonBands;
  /** The height of each row: compact 16, regular 24 or tall 36 pixels. */
  readonly height?: PlotHeight | undefined;
};

export const horizonLimits = { series: 40, pointsPerSeries: 1000 } as const;

const rowHeights = { compact: 16, regular: 24, tall: 36 } as const satisfies Readonly<Record<PlotHeight, number>>;

const ROW_GAP = 2;
const LABEL_OFFSET = 8;
const LABEL_BASELINE = 4;
const CURSOR_WIDTH = 12;
const X_TICK_SPACING = 96;
const BOTTOM_MARGIN = 44;
const BLANK = ' ';

const styles = stylex.create({
  footer: { display: 'grid', gap: spacing.sm, minWidth: 0 },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    margin: 0,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  group: { display: 'inline-flex', alignItems: 'center', gap: spacing.xs },
  swatch: (color: string) => ({
    display: 'inline-block',
    width: 12,
    height: 8,
    backgroundColor: color,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
  }),
  readout: {
    display: 'grid',
    gap: spacing.xs,
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  heading: { margin: 0, fontWeight: typography.mediumWeight },
  values: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
    columnGap: spacing.md,
    rowGap: 0,
    margin: 0,
  },
  idle: { visibility: 'hidden' },
  value: { display: 'flex', justifyContent: 'space-between', gap: spacing.sm, minWidth: 0 },
  name: {
    margin: 0,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.muted,
  },
  number: { margin: 0, whiteSpace: 'nowrap' },
  layer: (color: string) => ({ fill: color }),
});

function horizonInputError({
  series,
  xDomain,
  x,
  value,
}: Pick<HorizonChartProps, 'series' | 'x' | 'value'> & { readonly xDomain: NumericDomain }): string | undefined {
  const domainError = scaleDomainError(xDomain, x.scale) ?? scaleDomainError(value.domain);

  if (domainError !== undefined) {
    return domainError;
  }

  if (value.scale !== undefined && value.scale !== 'linear') {
    return 'A horizon chart folds values on a linear axis.';
  }

  if (value.domain[0] > 0 || value.domain[1] < 0) {
    return 'The value domain must contain zero, which is where the rows fold.';
  }

  if (!hasUniqueIds(series)) {
    return 'Series must have unique identifiers.';
  }

  if (series.length > horizonLimits.series) {
    return `This chart draws at most ${horizonLimits.series} series. Supply the ones to compare.`;
  }

  const long = series.find((item) => item.points.length > horizonLimits.pointsPerSeries);

  if (long !== undefined) {
    return `Series ${long.id} exceeds ${horizonLimits.pointsPerSeries} points. Supply a coarser sample.`;
  }

  const unordered = series.find(
    (item) =>
      item.points.some((point, index) => index > 0 && point.x <= (item.points[index - 1]?.x ?? 0)) ||
      item.points.some((point) => outsideDomain(point.x, xDomain)),
  );

  if (unordered !== undefined) {
    return `Series ${unordered.id} needs strictly increasing x values inside the declared domain.`;
  }

  const outside = series.find((item) =>
    item.points.some((point) => point.y !== null && outsideDomain(point.y, value.domain)),
  );

  return outside === undefined
    ? undefined
    : `Series ${outside.id} has a value that is not finite or lies outside the declared domain.`;
}

type BandColors = {
  /** The width of one band, in the value's unit. */
  readonly step: number;
  readonly positive: ReadonlyArray<string>;
  readonly negative: ReadonlyArray<string>;
};

/** The band width and the colors of each layer: one hue above zero, one below, each layer darker than the last. */
function bandColors({ domain, bands }: { readonly domain: NumericDomain; readonly bands: HorizonBands }): BandColors {
  const step = Math.max(domain[1], -domain[0]) / bands;
  const scale = { domain: [-step * bands, step * bands], palette: 'diverging' } as const;
  const layers = Array.from({ length: bands }, (_, index) => step * (index + 1));

  return {
    step,
    positive: layers.map((layer) => heatmapColor(layer, scale)),
    negative: layers.map((layer) => heatmapColor(-layer, scale)),
  };
}

function HorizonLegend({
  colors: ramp,
  format,
}: {
  readonly colors: BandColors;
  readonly format: (value: number) => string;
}): ReactNode {
  return (
    <p aria-label="Band thresholds" {...stylex.props(styles.legend)}>
      <span {...stylex.props(styles.group)}>
        Above zero
        {ramp.positive.map((color, index) => (
          <span
            key={color}
            {...stylex.props(styles.swatch(color))}
            title={`${format(ramp.step * index)} to ${format(ramp.step * (index + 1))}`}
          />
        ))}
      </span>
      <span {...stylex.props(styles.group)}>
        Below zero
        {ramp.negative.map((color, index) => (
          <span
            key={color}
            {...stylex.props(styles.swatch(color))}
            title={`${format(-ramp.step * index)} to ${format(-ramp.step * (index + 1))}`}
          />
        ))}
      </span>
      <span>{`Each band adds ${format(ramp.step)}, up to ${format(ramp.step * ramp.positive.length)}`}</span>
    </p>
  );
}

/**
 * Many series in little vertical space, such as per-layer activation statistics. Each series is a short row that folds
 * its values into layers: every layer is a darker step of one hue above zero and of a second hue below zero. The rows
 * share one x axis and one value domain so their colors compare, and the legend states where each band starts.
 */
export function HorizonChart(props: HorizonChartProps): ReactNode {
  const { series, x, value, bands, height = 'regular', ...figure } = props;
  const { emptyLabel = 'No observations are available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize(height);
  const readoutId = useId();
  const link = useLinkedInspection();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height="compact" />;
  }

  const observed = series.flatMap((item) => item.points);
  const xDomain = x.domain ?? fitDomain({ values: observed.map((point) => point.x), scale: x.scale });
  const inputError = horizonInputError({ series, xDomain, x, value });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  function xText(position: number): string {
    return formatValue({ value: position, locale, format: x.format });
  }

  function valueText(entry: number | null): string {
    return formatValue({ value: entry, locale, format: value.format });
  }

  const rowHeight = rowHeights[height];
  const drawnHeight = rowHeight - ROW_GAP;

  const margins = plotMargins({
    width: size.width,
    valueLabels: series.map((item) => item.label),
    hasXTitle: true,
    hasYTitle: false,
  });

  const box = plotBox({ width: size.width, height: margins.top + series.length * rowHeight + BOTTOM_MARGIN, margins });
  const xScale = continuousScale({ type: x.scale, domain: xDomain, range: [box.left, box.right] });
  const ramp = bandColors({ domain: value.domain, bands });
  const labelChars = gutterChars(box.left);

  const ticks = axisTicks({
    axis: x,
    domain: xDomain,
    length: box.innerWidth,
    spacing: X_TICK_SPACING,
    locale,
    hasTitle: true,
  });

  const xTicks: ReadonlyArray<PlotTick> = ticks.values.map((tick, index) => ({
    key: String(tick),
    position: xScale.position(tick),
    label: ticks.labels[index] ?? '',
  }));

  const positions = [...new Set(observed.map((point) => point.x))].toSorted((first, second) => first - second);

  function rowsAt(position: number | undefined): ReadonlyArray<ChartInspectionRow> {
    return series.map((item) => ({
      id: item.id,
      label: item.label,
      tone: 'neutral',
      value: position === undefined ? BLANK : valueText(item.points.find((point) => point.x === position)?.y ?? null),
    }));
  }

  const items = positions.map((position) => ({
    id: String(position),
    label: [`${x.label} ${xText(position)}`, ...rowsAt(position).map((row) => `${row.label}: ${row.value}`)].join(
      ' · ',
    ),
  }));

  const marks = positions.map((position) => ({ id: String(position), x: xScale.position(position), y: 0 }));

  return (
    <Chart
      {...link}
      items={items}
      locate={locateNearest({ marks, width: box.width, height: box.height, axis: 'x' })}
      render={(figureProps, { inspected, cursor }) => {
        const inspectedX = positions.find((position) => String(position) === inspected);
        const cursorX = positions.find((position) => String(position) === cursor);
        const label = inspectedX === undefined ? undefined : `${x.label} ${xText(inspectedX)}`;
        const rows = rowsAt(inspectedX);

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            scaleLegend={series.length === 0 ? undefined : <HorizonLegend colors={ramp} format={valueText} />}
            footer={
              series.length === 0 ? undefined : (
                <div {...stylex.props(styles.footer)}>
                  <span id={readoutId} {...stylex.props(accessibility.hidden)}>
                    {inspectionReadout({ label, rows })}
                  </span>
                  <div aria-hidden {...stylex.props(styles.readout)}>
                    <p {...stylex.props(styles.heading, label === undefined && styles.idle)}>{label ?? BLANK}</p>
                    <dl {...stylex.props(styles.values, label === undefined && styles.idle)}>
                      {rows.map((row) => (
                        <div key={row.id} {...stylex.props(styles.value)}>
                          <dt {...stylex.props(styles.name)}>{row.label}</dt>
                          <dd {...stylex.props(styles.number)}>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )
            }
          >
            {series.length === 0 || observed.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotSurface
                  plotRef={size.ref}
                  box={box}
                  label={plotLabel({ title, marks: `${x.label} positions`, isSelectable: false })}
                  readoutId={readoutId}
                >
                  <PlotAxes box={box} xTicks={xTicks} yTicks={[]} xTitle={axisTitle(x)} grid="x" />
                  <PlotClip box={box}>
                    {series.map((item, index) => {
                      const baseline = box.top + index * rowHeight + drawnHeight;

                      return (
                        <g key={item.id}>
                          <line
                            x1={box.left}
                            x2={box.right}
                            y1={baseline}
                            y2={baseline}
                            {...stylex.props(chartStyles.grid)}
                          />
                          {(['positive', 'negative'] as const).flatMap((sign) =>
                            ramp[sign].map((color, layer) => {
                              const points = item.points.map((point) => {
                                const folded =
                                  point.y === null || (sign === 'positive') !== point.y >= 0 ? 0 : Math.abs(point.y);

                                const share = Math.max(0, Math.min(ramp.step, folded - ramp.step * layer)) / ramp.step;

                                return {
                                  x: xScale.position(point.x),
                                  y0: point.y === null ? null : baseline,
                                  y1: point.y === null ? null : baseline - share * drawnHeight,
                                };
                              });

                              return (
                                <path
                                  key={`${sign}${color}`}
                                  d={areaPath(points)}
                                  {...stylex.props(styles.layer(color))}
                                />
                              );
                            }),
                          )}
                        </g>
                      );
                    })}
                    {inspectedX !== undefined && (
                      <line
                        x1={xScale.position(inspectedX)}
                        x2={xScale.position(inspectedX)}
                        y1={box.top}
                        y2={box.bottom}
                        {...stylex.props(chartStyles.baseline)}
                      />
                    )}
                  </PlotClip>
                  {series.map((item, index) => (
                    <LabelMark
                      key={item.id}
                      x={box.left - LABEL_OFFSET}
                      y={box.top + index * rowHeight + drawnHeight / 2 + LABEL_BASELINE}
                      anchor="end"
                    >
                      {truncateLabel(item.label, labelChars)}
                    </LabelMark>
                  ))}
                  {cursorX !== undefined && (
                    <ChartCursor x={xScale.position(cursorX)} top={box.top} bottom={box.bottom} width={CURSOR_WIDTH} />
                  )}
                </PlotSurface>
                <ChartData
                  label={`${title} observations`}
                  columns={[{ id: 'observation', label: 'Observation' }]}
                  rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
                />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
