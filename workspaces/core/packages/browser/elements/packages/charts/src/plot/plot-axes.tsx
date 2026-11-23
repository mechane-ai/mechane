import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartStyles } from '../chart-theme.ts';
import type { PlotBox, PlotTick } from './plot-layout.ts';

export type PlotAxesProps = {
  readonly box: PlotBox;
  /** The ticks along the bottom, at horizontal positions. */
  readonly xTicks: ReadonlyArray<PlotTick>;
  /** The ticks down the side, at vertical positions. */
  readonly yTicks: ReadonlyArray<PlotTick>;
  readonly xTitle?: string | undefined;
  readonly yTitle?: string | undefined;
  /** Which ticks draw a line across the plot. Lines follow the measured axis: horizontal ones by default. */
  readonly grid?: PlotGrid | undefined;
};

export type PlotGrid = 'x' | 'y' | 'both' | 'none';

const gridLines: Readonly<Record<PlotGrid, { readonly hasX: boolean; readonly hasY: boolean }>> = {
  x: { hasX: true, hasY: false },
  y: { hasX: false, hasY: true },
  both: { hasX: true, hasY: true },
  none: { hasX: false, hasY: false },
};

const CHARACTER_WIDTH = 7;
const LABEL_GAP = 16;
const TICK_LABEL_DROP = 18;
const TICK_LABEL_INSET = 8;
const BASELINE_SHIFT = 4;
/** The bottom title's baseline below the plot: under the tick labels with a gap, in the margin layouts reserve. */
const TITLE_DROP = 40;
const SIDE_TITLE_X = 16;
/** The room the side title takes left of the tick labels, as `plotMargins` reserves it. */
const SIDE_TITLE_BAND = 28;
const LINE_STEP = 14;
const LINE_BREAK = '\n';

/** How wide a tick label's longest line is, in pixels. */
function labelWidth(label: string): number {
  return Math.max(...label.split(LINE_BREAK).map((line) => line.length)) * CHARACTER_WIDTH;
}

/**
 * Shows every nth bottom label: the smallest n for which no two shown neighbours touch, measured label by label. So a
 * short label between long ones is kept when it fits. The grid keeps every tick.
 */
function labelStride(ticks: ReadonlyArray<PlotTick>, width: number): number {
  const placed = ticks.map((tick) => ({ x: insideWidth(tick, width), half: labelWidth(tick.label) / 2 }));
  const strides = Array.from({ length: Math.max(1, ticks.length) }, (_, index) => index + 1);

  return (
    strides.find((stride) =>
      placed.every((label, index) => {
        const next = placed[index + stride];

        return index % stride !== 0 || next === undefined || next.x - label.x >= label.half + next.half + LABEL_GAP;
      }),
    ) ?? 1
  );
}

/** The first line of a tick label and, when `categoryPlot` wrapped it, the second. */
function wrapLines(label: string): { readonly first: string; readonly second: string | undefined } {
  const [first = '', ...rest] = label.split(LINE_BREAK);

  return { first, second: rest.length === 0 ? undefined : rest.join(' ') };
}

/** Where a centered bottom label sits so that a long one, such as a full date, never runs past either edge. */
function insideWidth(tick: PlotTick, width: number): number {
  const half = labelWidth(tick.label) / 2;

  return Math.min(Math.max(tick.position, half), Math.max(half, width - half));
}

/**
 * The grid, tick labels and axis titles of a plot, which every chart draws here so its axes all read alike. A side
 * label longer than the left margin is cut with an ellipsis and keeps its full text in a title. Bottom labels that
 * would touch are thinned, and the readout still names every category.
 */
export function PlotAxes({ box, xTicks, yTicks, xTitle, yTitle, grid = 'y' }: PlotAxesProps): ReactNode {
  const stride = labelStride(xTicks, box.width);
  const { hasX: hasXGrid, hasY: hasYGrid } = gridLines[grid];
  const middleY = (box.top + box.bottom) / 2;

  const sideChars = Math.floor(
    (box.left - TICK_LABEL_INSET - (yTitle === undefined ? 0 : SIDE_TITLE_BAND)) / CHARACTER_WIDTH,
  );

  return (
    <g>
      {xTicks.map((tick, index) => {
        const lines = wrapLines(tick.label);
        const x = insideWidth(tick, box.width);

        return (
          <g key={tick.key}>
            {hasXGrid && (
              <line
                x1={tick.position}
                x2={tick.position}
                y1={box.top}
                y2={box.bottom}
                {...stylex.props(chartStyles.grid)}
              />
            )}
            {index % stride === 0 && (
              <text
                x={x}
                y={box.bottom + TICK_LABEL_DROP}
                textAnchor="middle"
                {...stylex.props(chartStyles.label, chartStyles.tick)}
              >
                {lines.first}
                {lines.second !== undefined && (
                  <tspan x={x} dy={LINE_STEP}>
                    {lines.second}
                  </tspan>
                )}
              </text>
            )}
          </g>
        );
      })}
      {yTicks.map((tick) => (
        <g key={tick.key}>
          {hasYGrid && (
            <line
              x1={box.left}
              x2={box.right}
              y1={tick.position}
              y2={tick.position}
              {...stylex.props(chartStyles.grid)}
            />
          )}
          <text
            x={box.left - TICK_LABEL_INSET}
            y={tick.position + BASELINE_SHIFT}
            textAnchor="end"
            {...stylex.props(chartStyles.label, chartStyles.tick)}
          >
            {tick.label.length <= sideChars ? (
              tick.label
            ) : (
              <>
                <title>{tick.label}</title>
                {`${tick.label.slice(0, Math.max(1, sideChars - 1)).trimEnd()}…`}
              </>
            )}
          </text>
        </g>
      ))}
      {xTitle !== undefined && (
        <text
          x={(box.left + box.right) / 2}
          y={box.bottom + TITLE_DROP}
          textAnchor="middle"
          {...stylex.props(chartStyles.label)}
        >
          {xTitle}
        </text>
      )}
      {yTitle !== undefined && (
        <text
          x={SIDE_TITLE_X}
          y={middleY}
          textAnchor="middle"
          transform={`rotate(-90 ${SIDE_TITLE_X} ${middleY})`}
          {...stylex.props(chartStyles.label)}
        >
          {yTitle}
        </text>
      )}
    </g>
  );
}
