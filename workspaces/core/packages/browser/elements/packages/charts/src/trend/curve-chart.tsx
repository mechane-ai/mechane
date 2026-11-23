import { useId } from 'react';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ReferenceMarks } from '../cartesian/reference-lines.tsx';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { ChartInspection } from '../chart-inspection.tsx';
import type { ChartInspectionRow } from '../chart-inspection.tsx';
import { useLinkedHighlight, useLinkedInspection } from '../chart-link.tsx';
import { Chart, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { freeLabelSpot, labelBox } from '../plot/label-place.ts';
import type { LabelSpot } from '../plot/label-place.ts';
import { locateNearest } from '../plot/locate.ts';
import { areaPath, isolatedPoints, linePath } from '../plot/path.ts';
import type { PathCurve } from '../plot/path.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { axisTitle, fitDomain, numericPlot } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { BandMark, DotMark, GuideMark, LabelMark, LineMark } from '../plot/plot-marks.tsx';
import type { MarkEmphasis, MarkStroke } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { EndLabels, gutterChars, labelGutter, truncateLabel } from './end-labels.tsx';

export type CurvePoint = {
  readonly x: number;
  /** The observed value, or null where none was recorded. The line breaks there. */
  readonly y: number | null;
  /** The bounds of an interval around the value, such as a spread across seeds. Supply both or neither. */
  readonly lower?: number | null | undefined;
  readonly upper?: number | null | undefined;
};

export type CurveSeries = {
  readonly id: string;
  readonly label: string;
  /** Observations in increasing `x`. Series need not share their `x` values. */
  readonly points: ReadonlyArray<CurvePoint>;
  readonly tone?: ChartTone | undefined;
  /** Dashed for a series that is modelled, not observed: a fit, a projection or a baseline. */
  readonly stroke?: MarkStroke | undefined;
  /** True for a series drawn in gray behind the others, as context. */
  readonly isContext?: boolean | undefined;
};

/** A level a reader compares the curves against, such as a target. The application computes it. */
export type CurveReference = { readonly id: string; readonly label: string; readonly y: number };

/** A position on the ordered variable the reader should find, such as the selected layer. Drawn as a labelled guide. */
export type CurveMarker = { readonly x: number; readonly label: string };

export type CurveChartProps = FigureProps & {
  readonly series: ReadonlyArray<CurveSeries>;
  /** The ordered variable: a training step, a layer, a dose, a context length. */
  readonly x: PlotAxis;
  readonly y: PlotAxis;
  readonly references?: ReadonlyArray<CurveReference> | undefined;
  /** Vertical guides at chosen `x` values, each named at the top of the plot. Values must lie inside the x domain. */
  readonly markers?: ReadonlyArray<CurveMarker> | undefined;
  readonly curve?: PathCurve | undefined;
  /**
   * Where series are named: in the legend, or beside the plot at the end of each line, spread apart so none overlap.
   * Choose nowhere when one legend beside a grid of panels already names them.
   */
  readonly labels?: 'legend' | 'inline' | 'none' | undefined;
  /**
   * The series drawn at full strength, on top, while the others fade. Emphasis only. Left out, it follows the enclosing
   * chart link: a term in the prose or a table row that inspects a series id highlights that series.
   */
  readonly highlighted?: string | null | undefined;
  readonly height?: PlotHeight | undefined;
};

export const curveLimits = { series: 12, pointsPerSeries: 2000, references: 8, markers: 8 } as const;

const LABEL_OFFSET = 6;
const LABEL_HEIGHT = 12;
const CURSOR_WIDTH = 12;
const ISOLATED_RADIUS = 2.5;

function curveInputError({
  series,
  references,
  markers,
  xDomain,
  yDomain,
  x,
  y,
}: Pick<CurveChartProps, 'series' | 'x' | 'y'> & {
  readonly references: ReadonlyArray<CurveReference>;
  readonly markers: ReadonlyArray<CurveMarker>;
  readonly xDomain: NumericDomain;
  readonly yDomain: NumericDomain;
}): string | undefined {
  const domainError = scaleDomainError(xDomain, x.scale) ?? scaleDomainError(yDomain, y.scale);

  if (domainError !== undefined) {
    return domainError;
  }

  if (!hasUniqueIds(series) || !hasUniqueIds(references)) {
    return 'Series and reference lines must have unique identifiers.';
  }

  if (
    series.length > curveLimits.series ||
    references.length > curveLimits.references ||
    markers.length > curveLimits.markers
  ) {
    return `This chart draws at most ${curveLimits.series} series, ${curveLimits.references} reference lines and ${curveLimits.markers} markers.`;
  }

  for (const item of series) {
    if (item.points.length > curveLimits.pointsPerSeries) {
      return `Series ${item.id} exceeds ${curveLimits.pointsPerSeries} points. Supply a window or a coarser sample.`;
    }

    const isOrdered = item.points.every((point, index) => index === 0 || point.x > (item.points[index - 1]?.x ?? 0));

    if (!isOrdered || item.points.some((point) => outsideDomain(point.x, xDomain))) {
      return `Series ${item.id} needs strictly increasing x values inside the declared domain.`;
    }

    const values = item.points.flatMap((point) => [point.y, point.lower ?? null, point.upper ?? null]);

    if (values.some((value) => value !== null && outsideDomain(value, yDomain))) {
      return `Series ${item.id} has a value that is not finite or lies outside the declared domain.`;
    }

    if (item.points.some((point) => ((point.lower ?? null) === null) !== ((point.upper ?? null) === null))) {
      return `Series ${item.id} has an interval with one bound. Supply both bounds or neither.`;
    }
  }

  if (references.some((reference) => outsideDomain(reference.y, yDomain))) {
    return 'A reference line lies outside the declared domain.';
  }

  if (markers.some((marker) => outsideDomain(marker.x, xDomain))) {
    return 'A marker lies outside the x domain.';
  }

  return undefined;
}

/**
 * Curves of a measure over an ordered variable that is not time: loss over training steps, accuracy over layers, an
 * effect over a dose. Either axis can be linear, log or symlog, each series can carry an uncertainty band, and a
 * modelled series is dashed. Use `LineChart` when the ordered variable is a timestamp.
 */
export function CurveChart(props: CurveChartProps): ReactNode {
  const { series, x, y, references = [], curve = 'linear', labels = 'legend', height = 'regular', ...rest } = props;
  const { highlighted, markers = [], ...figure } = rest;
  const { emptyLabel = 'No observations are available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize(height);
  const readoutId = useId();
  const tones = useTones();
  const link = useLinkedInspection();
  const focused = useLinkedHighlight({ ids: series.map((item) => item.id), highlighted });

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const observed = series.flatMap((item) => item.points);
  const yValues = observed.flatMap((point) => [point.y, point.lower ?? null, point.upper ?? null]);
  const xDomain = x.domain ?? fitDomain({ values: observed.map((point) => point.x), scale: x.scale });
  const yDomain = y.domain ?? fitDomain({ values: [...yValues, ...references.map((item) => item.y)], scale: y.scale });
  const inputError = curveInputError({ series, references, markers, xDomain, yDomain, x, y });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const gutter = labels === 'inline' ? labelGutter({ labels: series.map((item) => item.label), width: size.width }) : 0;

  const plot = numericPlot({
    width: size.width,
    height: size.height,
    x,
    y,
    xDomain,
    yDomain,
    locale,
    rightGutter: gutter,
  });

  const { box } = plot;
  const toned = series.map((item, index) => ({ ...item, tone: tones({ id: item.id, tone: item.tone, index }) }));
  const drawn = [...toned.filter((item) => item.id !== focused), ...toned.filter((item) => item.id === focused)];
  const positions = [...new Set(observed.map((point) => point.x))].toSorted((first, second) => first - second);

  function xText(value: number): string {
    return formatValue({ value, locale, format: x.format });
  }

  function yText(value: number | null): string {
    return formatValue({ value, locale, format: y.format });
  }

  function emphasisOf(item: CurveSeries): MarkEmphasis {
    if (item.isContext === true) {
      return 'context';
    }

    return focused === null || item.id === focused ? 'normal' : 'receded';
  }

  function rowsAt(position: number): ReadonlyArray<ChartInspectionRow> {
    return toned.flatMap((item) => {
      const point = item.points.find((candidate) => candidate.x === position);

      if (point === undefined) {
        return [];
      }

      const hasInterval = typeof point.lower === 'number' && typeof point.upper === 'number';
      const interval = hasInterval ? ` (${yText(point.lower ?? null)} – ${yText(point.upper ?? null)})` : '';

      return [{ id: item.id, label: item.label, tone: item.tone, value: `${yText(point.y)}${interval}` }];
    });
  }

  const items = positions.map((position) => {
    const values = rowsAt(position).map((row) => `${row.label}: ${row.value}`);

    return { id: String(position), label: [`${x.label} ${xText(position)}`, ...values].join(' · ') };
  });

  const legend = toned.map((item) => ({
    id: item.id,
    label: item.label,
    tone: item.isContext === true ? ('neutral' as const) : item.tone,
    shape: item.stroke === 'dashed' ? ('dashed' as const) : ('line' as const),
  }));

  const marks = positions.map((position) => ({ id: String(position), x: plot.x.position(position), y: 0 }));

  const obstacles = toned.map((item) =>
    item.points.flatMap((point) =>
      point.y === null ? [] : [{ x: plot.x.position(point.x), y: plot.y.position(point.y) }],
    ),
  );

  const markerLabels = markers.map((marker) => {
    const at = plot.x.position(marker.x);
    const top = box.top + LABEL_HEIGHT;
    const bottom = box.bottom - LABEL_OFFSET;

    const spots: ReadonlyArray<LabelSpot> = [
      { x: at + LABEL_OFFSET, y: top, anchor: 'start', text: marker.label },
      { x: at - LABEL_OFFSET, y: top, anchor: 'end', text: marker.label },
      { x: at + LABEL_OFFSET, y: bottom, anchor: 'start', text: marker.label },
      { x: at - LABEL_OFFSET, y: bottom, anchor: 'end', text: marker.label },
    ];

    const inside = spots.filter((spot) => {
      const covered = labelBox(spot);

      return covered.left >= box.left && covered.right <= box.right;
    });

    return {
      key: `${marker.x}:${marker.label}`,
      x: at,
      spot: freeLabelSpot({ spots: inside.length > 0 ? inside : spots, lines: obstacles }),
    };
  });

  return (
    <Chart
      {...link}
      items={items}
      locate={locateNearest({ marks, width: box.width, height: box.height, axis: 'x' })}
      render={(figureProps, { inspected, cursor }) => {
        const inspectedX = positions.find((position) => String(position) === inspected);
        const cursorX = positions.find((position) => String(position) === cursor);

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            series={legend}
            seriesLegend={
              observed.length === 0 ? undefined : (
                <ChartInspection
                  id={readoutId}
                  label={inspectedX === undefined ? undefined : `${x.label} ${xText(inspectedX)}`}
                  legend={legend}
                  rows={inspectedX === undefined ? [] : rowsAt(inspectedX)}
                  x={inspectedX === undefined ? 0 : plot.x.position(inspectedX)}
                  width={box.width}
                  hasLegend={labels === 'legend'}
                />
              )
            }
          >
            {observed.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotSurface
                  plotRef={size.ref}
                  box={box}
                  label={plotLabel({ title, marks: `${x.label} values`, isSelectable: false })}
                  readoutId={readoutId}
                >
                  <PlotAxes
                    box={box}
                    xTicks={plot.xTicks}
                    yTicks={plot.yTicks}
                    xTitle={axisTitle(x)}
                    yTitle={axisTitle(y)}
                  />
                  <PlotClip box={box}>
                    {drawn.map((item) => {
                      const emphasis = emphasisOf(item);

                      const line = item.points.map((point) => ({
                        x: plot.x.position(point.x),
                        y: point.y === null ? null : plot.y.position(point.y),
                      }));

                      const band = item.points.map((point) => ({
                        x: plot.x.position(point.x),
                        y0: typeof point.lower === 'number' ? plot.y.position(point.lower) : null,
                        y1: typeof point.upper === 'number' ? plot.y.position(point.upper) : null,
                      }));

                      return (
                        <g key={item.id}>
                          <BandMark d={areaPath(band)} tone={item.tone} emphasis={emphasis} />
                          <LineMark
                            d={linePath(line, curve)}
                            tone={item.tone}
                            stroke={item.stroke}
                            emphasis={emphasis}
                          />
                          {isolatedPoints(line).map((point) => (
                            <DotMark
                              key={point.x}
                              x={point.x}
                              y={point.y}
                              tone={item.tone}
                              radius={ISOLATED_RADIUS}
                              emphasis={emphasis}
                            />
                          ))}
                        </g>
                      );
                    })}
                    {inspectedX !== undefined &&
                      drawn.flatMap((item) => {
                        const point = item.points.find((candidate) => candidate.x === inspectedX);

                        return point === undefined || point.y === null
                          ? []
                          : [
                              <DotMark
                                key={item.id}
                                x={plot.x.position(point.x)}
                                y={plot.y.position(point.y)}
                                tone={item.tone}
                                isInspected
                              />,
                            ];
                      })}
                  </PlotClip>
                  {markerLabels.map((marker) => (
                    <g key={marker.key}>
                      <GuideMark x={marker.x} top={box.top} bottom={box.bottom} />
                      {marker.spot !== undefined && (
                        <LabelMark x={marker.spot.x} y={marker.spot.y} anchor={marker.spot.anchor}>
                          {marker.spot.text}
                        </LabelMark>
                      )}
                    </g>
                  ))}
                  <ReferenceMarks
                    lines={references.map((reference) => ({
                      id: reference.id,
                      label: reference.label,
                      value: reference.y,
                    }))}
                    box={box}
                    position={plot.y.position}
                    valueText={yText}
                    obstacles={obstacles}
                  />
                  {labels === 'inline' && (
                    <EndLabels
                      labels={drawn.flatMap((item) => {
                        const last = item.points.findLast((point) => point.y !== null);

                        return last === undefined || last.y === null
                          ? []
                          : [
                              {
                                id: item.id,
                                text: truncateLabel(item.label, gutterChars(gutter)),
                                tone: item.isContext === true ? ('neutral' as const) : item.tone,
                                y: plot.y.position(last.y),
                              },
                            ];
                      })}
                      x={box.right}
                      anchor="start"
                      top={box.top}
                      bottom={box.bottom}
                    />
                  )}
                  {cursorX !== undefined && (
                    <ChartCursor x={plot.x.position(cursorX)} top={box.top} bottom={box.bottom} width={CURSOR_WIDTH} />
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
