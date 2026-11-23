import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartPoint } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { areaPath, isolatedPoints, linePath } from '../plot/path.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { axisTitle, fitDomain, numericPlot } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { BandMark, DotMark, LineMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { EndLabels, gutterChars, labelGutter, LineCursor, truncateLabel } from './end-labels.tsx';
import { locateNearestLine } from './line-locate.ts';

export type RunPoint = {
  readonly x: number;
  /** The value recorded at this step, or null where none was. The line breaks there. */
  readonly y: number | null;
};

export type TrainingRun = {
  readonly id: string;
  readonly label: string;
  /** Records in strictly increasing `x`. Runs need not share their steps. */
  readonly points: ReadonlyArray<RunPoint>;
  /** The hue this run takes when it is featured, inspected or selected. */
  readonly tone?: ChartTone | undefined;
};

/** A line with a band that summarizes all runs, such as their median and quartiles. The application computes it. */
export type RunsSummary = {
  readonly label: string;
  readonly points: ReadonlyArray<{
    readonly x: number;
    readonly center: number;
    readonly lower: number;
    readonly upper: number;
  }>;
  /** The summary's hue. It defaults to the sixth series hue, so it never shares a color with the gray runs. */
  readonly tone?: ChartTone | undefined;
};

export type RunsChartProps = FigureProps &
  FigureSelectionProps & {
    readonly runs: ReadonlyArray<TrainingRun>;
    /** The ordered variable: a training step or a token count. */
    readonly x: PlotAxis;
    readonly y: PlotAxis;
    /** The ids of the runs to draw in their hue with a name at the end. Every other run stays gray context. */
    readonly featured: ReadonlyArray<string>;
    readonly summary?: RunsSummary | undefined;
    readonly height?: PlotHeight | undefined;
  };

export const runsLimits = { runs: 200, pointsPerRun: 500 } as const;

const EXACT_DISTANCE = 4;

type Pointer = { readonly id: string; readonly x: number | undefined };

function runsInputError({
  runs,
  featured,
  summary,
  xDomain,
  yDomain,
  x,
  y,
}: Pick<RunsChartProps, 'runs' | 'featured' | 'summary' | 'x' | 'y'> & {
  readonly xDomain: NumericDomain;
  readonly yDomain: NumericDomain;
}): string | undefined {
  const domainError = scaleDomainError(xDomain, x.scale) ?? scaleDomainError(yDomain, y.scale);

  if (domainError !== undefined) {
    return domainError;
  }

  if (!hasUniqueIds(runs)) {
    return 'Runs must have unique identifiers.';
  }

  if (runs.length > runsLimits.runs) {
    return `This chart draws at most ${runsLimits.runs} runs. Supply the runs to compare.`;
  }

  const unknown = featured.find((id) => !runs.some((run) => run.id === id));

  if (unknown !== undefined) {
    return `Highlighted run ${unknown} is not among the runs.`;
  }

  const points = [
    ...runs.map((run) => ({ id: run.id, points: run.points })),
    ...(summary === undefined ? [] : [{ id: 'summary', points: summary.points }]),
  ];

  const long = points.find((entry) => entry.points.length > runsLimits.pointsPerRun);

  if (long !== undefined) {
    return `Run ${long.id} exceeds ${runsLimits.pointsPerRun} points. Supply a window or a coarser sample.`;
  }

  const unordered = points.find(
    (entry) =>
      entry.points.some((point, index) => index > 0 && point.x <= (entry.points[index - 1]?.x ?? 0)) ||
      entry.points.some((point) => outsideDomain(point.x, xDomain)),
  );

  if (unordered !== undefined) {
    return `Run ${unordered.id} needs strictly increasing steps inside the declared domain.`;
  }

  const outside = runs.find((run) => run.points.some((point) => point.y !== null && outsideDomain(point.y, yDomain)));

  if (outside !== undefined) {
    return `Run ${outside.id} has a value that is not finite or lies outside the declared domain.`;
  }

  const isSummaryValid = (summary?.points ?? []).every(
    (point) =>
      [point.lower, point.center, point.upper].every((value) => !outsideDomain(value, yDomain)) &&
      point.lower <= point.center &&
      point.center <= point.upper,
  );

  return isSummaryValid
    ? undefined
    : 'The summary needs lower ≤ center ≤ upper inside the declared domain at every step.';
}

/**
 * Many training runs over a step axis, as thin gray lines for context, with the runs named in `featured` drawn on top
 * in their hue and labeled at the end. A summary the application supplies, such as the median and quartiles across
 * runs, is drawn as a line with a band. Pointing at a run, or stepping to it with the arrow keys, shows its name and
 * last recorded value, and `CurveChart` suits a handful of named series.
 */
export function RunsChart(props: RunsChartProps): ReactNode {
  const { runs, x, y, featured, summary, height = 'regular', selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No runs are available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize(height);
  const readoutId = useId();
  const tones = useTones();
  const link = useLinkedInspection();
  const [pointer, setPointer] = useState<Pointer | undefined>(undefined);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const xValues = [
    ...runs.flatMap((run) => run.points.map((point) => point.x)),
    ...(summary?.points ?? []).map((point) => point.x),
  ];

  const yValues = [
    ...runs.flatMap((run) => run.points.map((point) => point.y)),
    ...(summary?.points ?? []).flatMap((point) => [point.lower, point.center, point.upper]),
  ];

  const xDomain = x.domain ?? fitDomain({ values: xValues, scale: x.scale });
  const yDomain = y.domain ?? fitDomain({ values: yValues, scale: y.scale });
  const inputError = runsInputError({ runs, featured, summary, xDomain, yDomain, x, y });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  function xText(value: number): string {
    return formatValue({ value, locale, format: x.format });
  }

  function yText(value: number | null): string {
    return formatValue({ value, locale, format: y.format });
  }

  const gutter = labelGutter({
    width: size.width,
    labels: [...runs.map((run) => run.label), ...(summary === undefined ? [] : [summary.label])],
  });

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

  const drawn = runs.map((run, index) => ({
    ...run,
    line: run.points.map((point) => ({
      x: plot.x.position(point.x),
      y: point.y === null ? null : plot.y.position(point.y),
    })),
    index,
  }));

  const entries = runs.map((run) => {
    const last = run.points.findLast((point) => point.y !== null);

    return {
      id: run.id,
      label:
        last === undefined
          ? `${run.label}: no recorded values`
          : `${run.label}: last recorded ${x.label} ${xText(last.x)}, ${yText(last.y)}`,
    };
  });

  function pointerText(id: string | null): string {
    const point = drawn.find((run) => run.id === id)?.points.find((candidate) => candidate.x === pointer?.x);

    return pointer !== undefined && pointer.id === id && point !== undefined
      ? ` · At ${x.label} ${xText(point.x)}: ${yText(point.y)}`
      : '';
  }

  function hueOf(run: (typeof drawn)[number]): ChartTone {
    const place = featured.indexOf(run.id);

    return tones({ id: run.id, tone: run.tone, index: place === -1 ? run.index : place });
  }

  const locateRun = locateNearestLine({
    lines: drawn.map((run) => ({ id: run.id, points: run.line })),
    width: box.width,
    height: box.height,
  });

  function locatePointer(point: ChartPoint): string | undefined {
    const id = locateRun(point);

    const run = drawn.find((candidate) => candidate.id === id);
    const at = (point.x / point.width) * box.width;

    const nearest = run?.points.toSorted(
      (first, second) => Math.abs(plot.x.position(first.x) - at) - Math.abs(plot.x.position(second.x) - at),
    )[0];

    const isExact =
      nearest !== undefined && nearest.y !== null && Math.abs(plot.x.position(nearest.x) - at) <= EXACT_DISTANCE;

    const next = id === undefined ? undefined : { id, x: isExact ? nearest.x : undefined };

    setPointer((previous) => (previous?.id === next?.id && previous?.x === next?.x ? previous : next));

    return id;
  }

  const summaryTone = summary?.tone ?? 'series6';

  const summaryLine = (summary?.points ?? []).map((point) => ({
    x: plot.x.position(point.x),
    y: plot.y.position(point.center),
  }));

  const summaryBand = (summary?.points ?? []).map((point) => ({
    x: plot.x.position(point.x),
    y0: plot.y.position(point.lower),
    y1: plot.y.position(point.upper),
  }));

  const legend = [
    ...featured.map((id, index) => {
      const run = runs.find((candidate) => candidate.id === id);

      return { id, label: run?.label ?? id, tone: tones({ id, tone: run?.tone, index }), shape: 'line' as const };
    }),
    ...(summary === undefined
      ? []
      : [{ id: 'summary', label: summary.label, tone: summaryTone, shape: 'band' as const }]),
  ];

  return (
    <Chart
      {...link}
      items={entries}
      selected={selected}
      onSelect={onSelectedChange}
      locate={locatePointer}
      render={(figureProps, view) => {
        const focused = new Set([view.inspected, view.selected]);

        function isEmphasized(id: string): boolean {
          return featured.includes(id) || focused.has(id);
        }

        const emphasized = drawn.filter((run) => isEmphasized(run.id));
        const cursor = drawn.find((run) => run.id === view.cursor);

        const labels = [
          ...emphasized.flatMap((run) => {
            const last = run.line.findLast((point) => point.y !== null);
            const hue = hueOf(run);

            return last === undefined || last.y === null
              ? []
              : [{ id: run.id, text: truncateLabel(run.label, gutterChars(gutter)), tone: hue, y: last.y }];
          }),
          ...(summary === undefined || summaryLine.length === 0
            ? []
            : [
                {
                  id: 'summary',
                  text: truncateLabel(summary.label, gutterChars(gutter)),
                  tone: summaryTone,
                  y: summaryLine.at(-1)?.y ?? box.top,
                },
              ]),
        ];

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            series={legend}
            footer={
              runs.length === 0 ? undefined : (
                <ChartReadout
                  id={readoutId}
                >{`${inspectedLabel(entries, view.inspected)}${pointerText(view.inspected)}`}</ChartReadout>
              )
            }
          >
            {runs.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotSurface
                  plotRef={size.ref}
                  box={box}
                  label={plotLabel({ title, marks: 'runs', isSelectable: onSelectedChange !== undefined })}
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
                    {drawn
                      .filter((run) => !isEmphasized(run.id))
                      .map((run) => (
                        <LineMark key={run.id} d={linePath(run.line)} tone="neutral" emphasis="context" />
                      ))}
                    {summary !== undefined && (
                      <g>
                        <BandMark d={areaPath(summaryBand)} tone={summaryTone} />
                        <LineMark d={linePath(summaryLine)} tone={summaryTone} />
                      </g>
                    )}
                    {emphasized.map((run) => {
                      const tone = hueOf(run);

                      return (
                        <g key={run.id}>
                          <LineMark d={linePath(run.line)} tone={tone} />
                          {isolatedPoints(run.line).map((point) => (
                            <DotMark key={point.x} x={point.x} y={point.y} tone={tone} radius={2.5} />
                          ))}
                        </g>
                      );
                    })}
                    {cursor !== undefined && <LineCursor d={linePath(cursor.line)} />}
                  </PlotClip>
                  <EndLabels labels={labels} x={box.right} anchor="start" top={box.top} bottom={box.bottom} />
                </PlotSurface>
                <ChartData
                  label={`${title} runs`}
                  columns={[{ id: 'run', label: 'Run' }]}
                  rows={entries.map((entry) => ({ id: entry.id, values: [entry.label] }))}
                />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
