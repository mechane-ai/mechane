import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartLegend, ChartReadout } from '../chart-frame.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartPoint } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { contourSegments, sampleGrid, segmentsPath } from '../plot/contours.ts';
import type { GridPoint } from '../plot/contours.ts';
import { linePath } from '../plot/path.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { axisTitle, numericPlot } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { DotMark, LabelMark, LineMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { LevelLegend } from './level-legend.tsx';

/** A surface the application sampled on a regular grid. Row 0 is at the start of `yDomain`, the bottom of the plot. */
export type ContourGridInput = {
  readonly columns: number;
  readonly rows: number;
  /** `columns * rows` finite samples, row by row, each row from the start of `xDomain` to its end. */
  readonly values: ReadonlyArray<number>;
  /** The x values of the first and last column. */
  readonly xDomain: NumericDomain;
  /** The y values of the first and last row. */
  readonly yDomain: NumericDomain;
};

/** A route drawn over the surface, such as the steps an optimizer took. */
export type ContourPath = {
  readonly id: string;
  readonly label: string;
  readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>;
};

/** A place the reader should find, such as a minimum or a starting point. */
export type ContourMarker = { readonly id: string; readonly label: string; readonly x: number; readonly y: number };

export type ContourPlotProps = FigureProps &
  FigureSelectionProps & {
    readonly grid: ContourGridInput;
    /** The values to draw a line at, in increasing order. The application chooses them. */
    readonly levels: ReadonlyArray<number>;
    readonly x: PlotAxis;
    readonly y: PlotAxis;
    /** What the surface measures, such as a loss, and how its levels are written. */
    readonly value: { readonly label: string; readonly format: ValueFormat };
    readonly path?: ReadonlyArray<ContourPath> | undefined;
    readonly markers?: ReadonlyArray<ContourMarker> | undefined;
    readonly height?: PlotHeight | undefined;
  };

export const contourLimits = {
  columns: 128,
  rows: 128,
  levels: 16,
  paths: 6,
  pointsPerPath: 2000,
  markers: 12,
} as const;

const GRID_MINIMUM = 2;
const LEVEL_PREFIX = 'level:';
const LABELLED_LEVELS = 4;
const SHARE_MINIMUM = 45;
const PERCENT = 100;
const MARKER_RADIUS = 5;
const MARKER_HIT = 14;
const END_RADIUS = 3.5;
const LABEL_RISE = 6;
const CURSOR_RADIUS = 9;
const HALF = 0.5;
const LABEL_ASCENT = 12;
const LABEL_DESCENT = 4;
const LABEL_CHARACTER = 7;
const LABEL_PADDING = 4;

type Rect = { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };

function labelRect({ x, y, text }: { readonly x: number; readonly y: number; readonly text: string }): Rect {
  const half = (text.length * LABEL_CHARACTER) / 2 + LABEL_PADDING;

  return { x0: x - half, x1: x + half, y0: y - LABEL_ASCENT - LABEL_PADDING, y1: y + LABEL_DESCENT + LABEL_PADDING };
}

function areOverlapping(first: Rect, second: Rect): boolean {
  const isOverlappingX = first.x0 < second.x1 && second.x0 < first.x1;
  const isOverlappingY = first.y0 < second.y1 && second.y0 < first.y1;

  return isOverlappingX && isOverlappingY;
}

const styles = stylex.create({
  level: (color: string) => ({ stroke: color, fill: 'none' }),
  focused: { stroke: colors.ink, strokeWidth: 2.5 },
  cursor: { fill: 'none' },
});

function levelColor({ index, count }: { readonly index: number; readonly count: number }): string {
  const share = count > 1 ? index / (count - 1) : 1;
  const intensity = SHARE_MINIMUM + (PERCENT - SHARE_MINIMUM) * share;

  return `color-mix(in srgb, ${chartToneColors.series1} ${intensity}%, ${colors.surface})`;
}

function contourInputError({
  grid,
  levels,
  paths,
  markers,
  xDomain,
  yDomain,
  x,
  y,
}: Pick<ContourPlotProps, 'grid' | 'levels' | 'x' | 'y'> & {
  readonly paths: ReadonlyArray<ContourPath>;
  readonly markers: ReadonlyArray<ContourMarker>;
  readonly xDomain: NumericDomain;
  readonly yDomain: NumericDomain;
}): string | undefined {
  const gridError = scaleDomainError(grid.xDomain) ?? scaleDomainError(grid.yDomain);
  const domainError = gridError ?? scaleDomainError(xDomain, x.scale) ?? scaleDomainError(yDomain, y.scale);

  if (domainError !== undefined) {
    return domainError;
  }

  const isIntegerSize = Number.isInteger(grid.columns) && Number.isInteger(grid.rows);

  if (!isIntegerSize || grid.columns < GRID_MINIMUM || grid.rows < GRID_MINIMUM) {
    return `The grid needs at least ${GRID_MINIMUM} columns and ${GRID_MINIMUM} rows.`;
  }

  if (grid.columns > contourLimits.columns || grid.rows > contourLimits.rows) {
    return `This chart draws a grid of at most ${contourLimits.columns} by ${contourLimits.rows} samples. Supply a coarser sample.`;
  }

  if (grid.values.length !== grid.columns * grid.rows || grid.values.some((value) => !Number.isFinite(value))) {
    return 'The grid needs one finite value for each of its columns and rows.';
  }

  if (levels.length === 0 || levels.length > contourLimits.levels) {
    return `This chart draws 1 to ${contourLimits.levels} levels.`;
  }

  const isIncreasing = levels.every((level, index) => {
    const isAbovePrevious = index === 0 || level > (levels[index - 1] ?? 0);

    return Number.isFinite(level) && isAbovePrevious;
  });

  if (!isIncreasing) {
    return 'Levels must be finite values in increasing order.';
  }

  if (paths.length > contourLimits.paths || markers.length > contourLimits.markers) {
    return `This chart draws at most ${contourLimits.paths} paths and ${contourLimits.markers} markers.`;
  }

  const ids = [...paths, ...markers].map((item) => item.id);

  if (new Set(ids).size !== ids.length || ids.some((id) => id.startsWith(LEVEL_PREFIX))) {
    return `Paths and markers need unique identifiers that do not start with "${LEVEL_PREFIX}".`;
  }

  const positions = [...paths.flatMap((item) => item.points), ...markers];

  if (paths.some((item) => item.points.length > contourLimits.pointsPerPath)) {
    return `A path exceeds ${contourLimits.pointsPerPath} points. Supply a coarser sample.`;
  }

  if (positions.some((point) => outsideDomain(point.x, xDomain) || outsideDomain(point.y, yDomain))) {
    return 'A path or marker lies outside the declared domain.';
  }

  return undefined;
}

/**
 * Level lines of a surface the application sampled on a grid, such as a loss landscape. Each level is one line whose
 * shade steps with its value, and a path or markers can be drawn over it. Use it to show where a measure is high or low
 * across two inputs, with the grid, the levels and any path supplied by the application.
 */
export function ContourPlot(props: ContourPlotProps): ReactNode {
  const {
    grid,
    levels,
    x,
    y,
    value,
    path = [],
    markers = [],
    height = 'tall',
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No surface is available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize(height);
  const readoutId = useId();
  const tones = useTones();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const xDomain = x.domain ?? grid.xDomain;
  const yDomain = y.domain ?? grid.yDomain;
  const isEmpty = grid.values.length === 0;

  const inputError = isEmpty
    ? undefined
    : contourInputError({ grid, levels, paths: path, markers, xDomain, yDomain, x, y });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const plot = numericPlot({ width: size.width, height: size.height, x, y, xDomain, yDomain, locale });
  const { box } = plot;
  const xSpan = grid.xDomain[1] - grid.xDomain[0];
  const ySpan = grid.yDomain[1] - grid.yDomain[0];

  function position(point: GridPoint): { readonly x: number; readonly y: number } {
    return {
      x: plot.x.position(grid.xDomain[0] + (point.column / (grid.columns - 1)) * xSpan),
      y: plot.y.position(grid.yDomain[0] + (point.row / (grid.rows - 1)) * ySpan),
    };
  }

  function levelText(level: number): string {
    return formatValue({ value: level, locale, format: value.format });
  }

  function surfaceAt(point: { readonly x: number; readonly y: number }): number | undefined {
    return sampleGrid({
      grid,
      point: {
        column: ((point.x - grid.xDomain[0]) / xSpan) * (grid.columns - 1),
        row: ((point.y - grid.yDomain[0]) / ySpan) * (grid.rows - 1),
      },
    });
  }

  function bandText(at: number | undefined): string {
    const above = levels.findIndex((level) => level > (at ?? Number.NaN));
    const first = levels[0];
    const last = levels.at(-1);

    if (at === undefined || first === undefined || last === undefined) {
      return 'outside the sampled surface';
    }

    if (above === 0) {
      return `below the lowest level, ${levelText(first)}`;
    }

    return above === -1
      ? `at or above the highest level, ${levelText(last)}`
      : `between level ${levelText(levels[above - 1] ?? first)} and level ${levelText(levels[above] ?? last)}`;
  }

  const lines = levels.map((level, index) => {
    const segments = contourSegments({ grid, level });

    return {
      id: `${LEVEL_PREFIX}${index}`,
      level,
      color: levelColor({ index, count: levels.length }),
      d: segmentsPath({ segments, position }),
      midpoints: segments.map((segment) => {
        const from = position(segment.from);
        const to = position(segment.to);

        return { x: (from.x + to.x) * HALF, y: (from.y + to.y) * HALF };
      }),
    };
  });

  const centerX = (box.left + box.right) * HALF;
  const centerY = (box.top + box.bottom) * HALF;

  const routes = path.map((route, index) => ({
    ...route,
    tone: tones({ id: route.id, index: index + 1 }),
    positions: route.points.map((point) => ({ x: plot.x.position(point.x), y: plot.y.position(point.y) })),
  }));

  const places = markers.map((marker, index) => ({
    ...marker,
    tone: tones({ id: marker.id, index: routes.length + index + 1 }),
    px: plot.x.position(marker.x),
    py: plot.y.position(marker.y),
  }));

  const stride = Math.ceil(levels.length / LABELLED_LEVELS);
  const bounds = { x0: box.left, y0: box.top, x1: box.right, y1: box.bottom };

  const reserved = places.flatMap((place) => [
    labelRect({ x: place.px, y: place.py - MARKER_RADIUS - LABEL_RISE, text: place.label }),
    {
      x0: place.px - MARKER_RADIUS - LABEL_PADDING,
      x1: place.px + MARKER_RADIUS + LABEL_PADDING,
      y0: place.py - MARKER_RADIUS - LABEL_PADDING,
      y1: place.py + MARKER_RADIUS + LABEL_PADDING,
    },
  ]);

  /**
   * Level labels on their own lines, nearest the middle first. A label that would sit on a marker, a marker's name or
   * another level label moves along its line, and is dropped when none of the line is free.
   *
   * @yields One label for each labelled level that has free space.
   */
  function* levelLabels(): Generator<{
    readonly id: string;
    readonly text: string;
    readonly x: number;
    readonly y: number;
  }> {
    const state = { taken: reserved };

    for (const line of lines.filter((_, index) => index % stride === 0)) {
      const text = levelText(line.level);

      const free = line.midpoints
        .toSorted(
          (first, second) =>
            (first.x - centerX) ** 2 +
            (first.y - centerY) ** 2 -
            ((second.x - centerX) ** 2 + (second.y - centerY) ** 2),
        )
        .map((point) => ({ id: line.id, text, x: point.x, y: point.y - LABEL_RISE }))
        .find((label) => {
          const rect = labelRect(label);

          const isWithinX = rect.x0 >= bounds.x0 && rect.x1 <= bounds.x1;
          const isWithinY = rect.y0 >= bounds.y0 && rect.y1 <= bounds.y1;

          return isWithinX && isWithinY && !state.taken.some((taken) => areOverlapping(rect, taken));
        });

      if (free !== undefined) {
        state.taken = [...state.taken, labelRect(free)];
        yield free;
      }
    }
  }

  const labels = Array.from(levelLabels());

  const items = [
    ...lines.map((line) => ({ id: line.id, label: `${value.label} level ${levelText(line.level)}` })),
    ...places.map((place) => ({
      id: place.id,
      label: [
        place.label,
        `${x.label}: ${formatValue({ value: place.x, locale, format: x.format })}`,
        `${y.label}: ${formatValue({ value: place.y, locale, format: y.format })}`,
        `${value.label} is ${bandText(surfaceAt(place))}`,
      ].join(' · '),
    })),
  ];

  function locate(point: ChartPoint): string | undefined {
    const px = (point.x / point.width) * box.width;
    const py = (point.y / point.height) * box.height;

    const near = places
      .map((place) => ({ id: place.id, distance: Math.hypot(place.px - px, place.py - py) }))
      .filter((candidate) => candidate.distance <= MARKER_HIT)
      .toSorted((first, second) => first.distance - second.distance)[0];

    if (near !== undefined) {
      return near.id;
    }

    const at = surfaceAt({ x: plot.x.valueAt(px), y: plot.y.valueAt(py) });

    return lines
      .map((line) => ({ id: line.id, distance: Math.abs(line.level - (at ?? Number.NaN)) }))
      .filter((candidate) => !Number.isNaN(candidate.distance))
      .toSorted((first, second) => first.distance - second.distance)[0]?.id;
  }

  const legend = routes.map((route) => ({
    id: route.id,
    label: route.label,
    tone: route.tone,
    shape: 'line' as const,
  }));

  return (
    <Chart
      items={items}
      locate={locate}
      selected={selected}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, selected: selectedId, cursor }) => {
        const focusedLines = lines.filter((line) => line.id === inspected || line.id === selectedId);
        const cursorLine = lines.find((line) => line.id === cursor);
        const cursorPlace = places.find((place) => place.id === cursor);

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            series={legend}
            seriesLegend={legend.length > 0 ? <ChartLegend items={legend} /> : undefined}
            scaleLegend={
              isEmpty ? undefined : (
                <LevelLegend
                  label={`${value.label} levels`}
                  entries={lines.map((line) => ({ id: line.id, text: levelText(line.level), color: line.color }))}
                />
              )
            }
            footer={
              isEmpty ? undefined : (
                <ChartReadout id={readoutId}>{inspectedLabel(items, inspected ?? selectedId)}</ChartReadout>
              )
            }
          >
            {isEmpty ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotSurface
                  plotRef={size.ref}
                  box={box}
                  label={plotLabel({
                    title,
                    marks: 'levels and markers',
                    isSelectable: onSelectedChange !== undefined,
                  })}
                  readoutId={readoutId}
                >
                  <PlotAxes
                    box={box}
                    xTicks={plot.xTicks}
                    yTicks={plot.yTicks}
                    xTitle={axisTitle(x)}
                    yTitle={axisTitle(y)}
                    grid="none"
                  />
                  <PlotClip box={box}>
                    {lines.map((line) => (
                      <path
                        key={line.id}
                        d={line.d}
                        {...stylex.props(chartStyles.mark, chartStyles.emphasis, styles.level(line.color))}
                      />
                    ))}
                    {focusedLines.map((line) => (
                      <path
                        key={line.id}
                        d={line.d}
                        {...stylex.props(chartStyles.mark, styles.level(line.color), styles.focused)}
                      />
                    ))}
                    {cursorLine !== undefined && (
                      <path d={cursorLine.d} {...stylex.props(chartStyles.shapeCursor, styles.cursor)} />
                    )}
                    {routes.map((route) => (
                      <g key={route.id}>
                        <LineMark d={linePath(route.positions)} tone={route.tone} />
                        {route.positions.slice(0, 1).map((start) => (
                          <DotMark key="start" x={start.x} y={start.y} tone={route.tone} radius={END_RADIUS} isHollow />
                        ))}
                        {route.positions.slice(-1).map((end) => (
                          <DotMark key="end" x={end.x} y={end.y} tone={route.tone} radius={END_RADIUS} />
                        ))}
                      </g>
                    ))}
                    {places.map((place) => (
                      <DotMark
                        key={place.id}
                        x={place.px}
                        y={place.py}
                        tone={place.tone}
                        radius={MARKER_RADIUS}
                        isInspected={place.id === inspected}
                        isSelected={place.id === selectedId}
                      />
                    ))}
                    {cursorPlace !== undefined && (
                      <circle
                        cx={cursorPlace.px}
                        cy={cursorPlace.py}
                        r={CURSOR_RADIUS}
                        {...stylex.props(chartStyles.shapeCursor, styles.cursor)}
                      />
                    )}
                  </PlotClip>
                  {labels.map((label) => (
                    <LabelMark key={label.id} x={label.x} y={label.y} anchor="middle">
                      {label.text}
                    </LabelMark>
                  ))}
                  {places.map((place) => (
                    <LabelMark
                      key={place.id}
                      x={place.px}
                      y={place.py - MARKER_RADIUS - LABEL_RISE}
                      anchor="middle"
                      tone={place.tone}
                    >
                      {place.label}
                    </LabelMark>
                  ))}
                </PlotSurface>
                <ChartData
                  label={`${title} levels and markers`}
                  columns={[{ id: 'item', label: 'Level or marker' }]}
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
