import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartItem, ChartPoint, ChartView } from '../chart.tsx';
import { FigureEmpty, FigureFrame } from '../figure/figure-frame.tsx';
import type { FigureFrameInput, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { PlotAxes } from '../plot/plot-axes.tsx';
import type { Segment } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface } from '../plot/plot-surface.tsx';
import type { usePlotSize } from '../plot/plot-surface.tsx';
import type { GroupAxes, Slot } from './group-plot-layout.ts';

const styles = stylex.create({
  note: {
    margin: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    paddingBlockStart: spacing.xs,
  },
  ink: { stroke: colors.ink, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke', pointerEvents: 'none' },
  dot: {
    fill: colors.surface,
    stroke: colors.ink,
    strokeWidth: 1.5,
    vectorEffect: 'non-scaling-stroke',
    pointerEvents: 'none',
  },
  unfilled: { fill: 'none', pointerEvents: 'none' },
});

const fills = stylex.create({ soft: { fillOpacity: 0.3 }, strong: { fillOpacity: 0.78 } });
const weights = stylex.create({ thin: { strokeWidth: 2.5 }, thick: { strokeWidth: 5 } });

const MEDIAN_RADIUS = 3.5;
const CURSOR_PADDING = 4;

/**
 * Gives each record the tone it draws in: its own, the enclosing scope's, or the hue its place in the figure assigns.
 * Call it before any early return, because it reads the tone scope.
 */
export function useToned<Item extends { readonly id: string; readonly tone?: ChartTone | undefined }>(
  records: ReadonlyArray<Item>,
): ReadonlyArray<Item & { readonly tone: ChartTone }> {
  const tones = useTones();

  return records.map((record, index) => ({ ...record, tone: tones({ id: record.id, tone: record.tone, index }) }));
}

/** A closed shape tinted in a group's hue with a crisp edge: a box, a violin or a ridge. */
export function ShapeMark({
  d,
  tone,
  fill,
  isInspected = false,
  isSelected = false,
}: {
  /** The path from `shapePath`. */
  readonly d: string;
  readonly tone: ChartTone;
  /** `soft` lets what lies behind show through; `strong` is a filled body. */
  readonly fill: 'soft' | 'strong';
  readonly isInspected?: boolean | undefined;
  readonly isSelected?: boolean | undefined;
}): ReactNode {
  return (
    <path
      d={d}
      fill={chartToneColors[tone]}
      stroke={chartToneOutlines[tone]}
      {...stylex.props(
        chartStyles.outlined,
        chartStyles.emphasis,
        fills[fill],
        isInspected && chartStyles.inspected,
        isSelected && chartStyles.selected,
      )}
    />
  );
}

/** A segment in ink that marks a summary on top of the data: a median, a typical value or an interquartile bar. */
export function InkBarMark({ weight, ...segment }: Segment & { readonly weight: 'thin' | 'thick' }): ReactNode {
  return <line {...segment} {...stylex.props(styles.ink, weights[weight])} />;
}

/** A dot in ink on a surface-colored fill, for the median inside a violin. */
export function InkDotMark({ x, y }: { readonly x: number; readonly y: number }): ReactNode {
  return <circle cx={x} cy={y} r={MEDIAN_RADIUS} {...stylex.props(styles.dot)} />;
}

/** The keyboard cursor around one group's band. */
export function BandCursor({ x, y, width, height }: Slot): ReactNode {
  return <rect x={x} y={y} width={width} height={height} {...stylex.props(styles.unfilled, chartStyles.cursor)} />;
}

/** The keyboard cursor around one dot. */
export function PointCursor({
  x,
  y,
  radius,
}: {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}): ReactNode {
  return (
    <circle cx={x} cy={y} r={radius + CURSOR_PADDING} {...stylex.props(styles.unfilled, chartStyles.shapeCursor)} />
  );
}

export type GroupFigureProps = FigureSelectionProps & {
  /** The figure's shared props, without the empty label. */
  readonly frame: FigureFrameInput;
  readonly emptyLabel: string;
  /** What the figure measured with `usePlotSize`. */
  readonly size: ReturnType<typeof usePlotSize>;
  readonly axes: GroupAxes;
  /** What the arrow keys step through. No items means there is nothing to draw. */
  readonly items: ReadonlyArray<ChartItem>;
  readonly locate: (point: ChartPoint) => string | undefined;
  /** Where each item sits, so the arrow keys move to the nearest one in their direction. */
  readonly place?:
    | ((id: string) => { left: number; top: number; right: number; bottom: number } | undefined)
    | undefined;
  /** Names what the arrow keys step through, for the plot's accessible name: "groups". */
  readonly marksLabel: string;
  /** A line under the readout that says how to read the marks. */
  readonly note?: string | undefined;
  readonly marks: (view: ChartView) => ReactNode;
  readonly cursor: (id: string) => ReactNode;
};

/**
 * The frame, axes, readout, keyboard cursor and exact-value table that charts of named groups share. Each chart
 * supplies its marks and what its items say.
 */
export function GroupFigure({
  frame,
  emptyLabel,
  size,
  axes,
  items,
  locate,
  place,
  marksLabel,
  note,
  marks,
  cursor,
  selected,
  onSelectedChange,
}: GroupFigureProps): ReactNode {
  const readoutId = useId();
  const link = useLinkedInspection();
  const { box, xTicks, yTicks, xTitle, yTitle, grid } = axes;

  return (
    <Chart
      {...link}
      items={items}
      locate={locate}
      place={place}
      selected={selected}
      onSelect={onSelectedChange}
      render={(figure, view) => (
        <FigureFrame
          {...frame}
          figure={figure}
          footer={
            items.length === 0 ? undefined : (
              <>
                <ChartReadout id={readoutId}>{inspectedLabel(items, view.inspected)}</ChartReadout>
                {note !== undefined && <p {...stylex.props(styles.note)}>{note}</p>}
              </>
            )
          }
        >
          {items.length === 0 ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <>
              <PlotSurface
                plotRef={size.ref}
                box={box}
                label={plotLabel({
                  title: frame.title,
                  marks: marksLabel,
                  isSelectable: onSelectedChange !== undefined,
                })}
                readoutId={readoutId}
              >
                <PlotAxes box={box} xTicks={xTicks} yTicks={yTicks} xTitle={xTitle} yTitle={yTitle} grid={grid} />
                <PlotClip box={box}>{marks(view)}</PlotClip>
                {view.cursor !== null && cursor(view.cursor)}
              </PlotSurface>
              <ChartData
                label={`${frame.title} ${marksLabel}`}
                columns={[{ id: 'observation', label: 'Observation' }]}
                rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
              />
            </>
          )}
        </FigureFrame>
      )}
    />
  );
}
