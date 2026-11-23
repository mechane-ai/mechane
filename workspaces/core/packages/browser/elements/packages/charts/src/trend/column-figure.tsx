import { useId } from 'react';
import type { ReactNode, Ref } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import type { ChartLegendItem } from '../chart-frame.tsx';
import { useLinkedInspection } from '../chart-link.tsx';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartItem } from '../chart.tsx';
import { FigureEmpty, FigureFrame } from '../figure/figure-frame.tsx';
import type { FigureFrameInput, FigureSelectionProps } from '../figure/figure-props.ts';
import { linePath } from '../plot/path.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import type { PlotBox, PlotTick } from '../plot/plot-layout.ts';
import { DotMark, LineMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface } from '../plot/plot-surface.tsx';
import { EndLabels, LineCursor } from './end-labels.tsx';
import type { EndLabel } from './end-labels.tsx';
import { locateNearestLine } from './line-locate.ts';

const DOT_RADIUS = 3.5;

/** One line across ordered columns, already placed in the plot's pixels. */
export type ColumnLine = {
  readonly id: string;
  readonly tone: ChartTone;
  /** The vertical position at each column, or null where nothing was recorded. */
  readonly ys: ReadonlyArray<number | null>;
  /** The label at the first column, and the one at the last. */
  readonly startLabel: string;
  readonly endLabel: string;
};

export type ColumnFigureProps = FigureSelectionProps & {
  readonly frame: FigureFrameInput;
  readonly emptyLabel: string;
  readonly plotRef: Ref<HTMLDivElement>;
  readonly box: PlotBox;
  /** The horizontal position of each column. */
  readonly xs: ReadonlyArray<number>;
  readonly xTicks: ReadonlyArray<PlotTick>;
  readonly yTicks: ReadonlyArray<PlotTick>;
  readonly yTitle: string;
  readonly lines: ReadonlyArray<ColumnLine>;
  /** What the arrow keys step through, with each one's exact values as a sentence. */
  readonly items: ReadonlyArray<ChartItem>;
  readonly legend: ReadonlyArray<ChartLegendItem>;
  /** What the plot's lines are called in its accessible name: "items". */
  readonly marks: string;
};

/**
 * The shared body of the charts that join one thing's values across a few ordered columns. It draws lines and dots at
 * each recorded value and names at both ends, and the others recede while one line is inspected or selected.
 */
export function ColumnFigure({
  frame,
  emptyLabel,
  plotRef,
  box,
  xs,
  xTicks,
  yTicks,
  yTitle,
  lines,
  items,
  legend,
  marks,
  selected,
  onSelectedChange,
}: ColumnFigureProps): ReactNode {
  const readoutId = useId();
  const link = useLinkedInspection();
  const isSelectable = onSelectedChange !== undefined;

  const located = lines.map((line) => ({
    id: line.id,
    points: xs.map((x, index) => ({ x, y: line.ys[index] ?? null })),
  }));

  return (
    <Chart
      {...link}
      items={items}
      selected={selected}
      onSelect={onSelectedChange}
      locate={locateNearestLine({ lines: located, width: box.width, height: box.height })}
      render={(figureProps, view) => {
        const focus = view.inspected ?? view.selected;
        const cursor = located.find((line) => line.id === view.cursor);
        const ordered = lines.toSorted((first, second) => Number(first.id === focus) - Number(second.id === focus));
        const lastIndex = xs.length - 1;

        function ends(index: number, pick: (line: ColumnLine) => string): ReadonlyArray<EndLabel> {
          return lines.flatMap((line) => {
            const y = line.ys[index];

            return y === null || y === undefined
              ? []
              : [
                  {
                    id: line.id,
                    text: pick(line),
                    y,
                    tone: focus === null || focus === line.id ? line.tone : 'neutral',
                  },
                ];
          });
        }

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            series={legend}
            footer={
              lines.length === 0 ? undefined : (
                <ChartReadout id={readoutId}>{inspectedLabel(items, view.inspected)}</ChartReadout>
              )
            }
          >
            {lines.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotSurface
                  plotRef={plotRef}
                  box={box}
                  label={plotLabel({ title: frame.title, marks, isSelectable })}
                  readoutId={readoutId}
                >
                  <PlotAxes box={box} xTicks={xTicks} yTicks={yTicks} yTitle={yTitle} grid="both" />
                  <PlotClip box={box}>
                    {ordered.map((line) => {
                      const points = xs.map((x, index) => ({ x, y: line.ys[index] ?? null }));
                      const emphasis = focus === null || focus === line.id ? 'normal' : 'receded';

                      return (
                        <g key={line.id}>
                          <LineMark d={linePath(points)} tone={line.tone} emphasis={emphasis} />
                          {points.flatMap((point) =>
                            point.y === null
                              ? []
                              : [
                                  <DotMark
                                    key={point.x}
                                    x={point.x}
                                    y={point.y}
                                    tone={line.tone}
                                    radius={DOT_RADIUS}
                                    emphasis={emphasis}
                                    isInspected={view.inspected === line.id}
                                    isSelected={view.selected === line.id}
                                  />,
                                ],
                          )}
                        </g>
                      );
                    })}
                    {cursor !== undefined && <LineCursor d={linePath(cursor.points)} />}
                  </PlotClip>
                  <EndLabels
                    labels={ends(0, (line) => line.startLabel)}
                    x={xs[0] ?? box.left}
                    anchor="end"
                    top={box.top}
                    bottom={box.bottom}
                  />
                  <EndLabels
                    labels={ends(lastIndex, (line) => line.endLabel)}
                    x={xs[lastIndex] ?? box.right}
                    anchor="start"
                    top={box.top}
                    bottom={box.bottom}
                  />
                </PlotSurface>
                <ChartData
                  label={`${frame.title} values`}
                  columns={[{ id: 'line', label: 'Values' }]}
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
