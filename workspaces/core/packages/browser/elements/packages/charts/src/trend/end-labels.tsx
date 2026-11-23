import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { chartStyles } from '../chart-theme.ts';
import { spreadPositions } from '../label-spacing.ts';
import { LabelMark } from '../plot/plot-marks.tsx';

/** The average width of a caption character in the body face, in pixels. */
const CHARACTER_WIDTH = 6.5;
const LABEL_OFFSET = 8;
const LABEL_GAP = 14;
const LABEL_BASELINE = 4;
const GUTTER_SHARE = 0.4;

const styles = stylex.create({ cursor: { fill: 'none', pointerEvents: 'none' } });

/**
 * The pixels a column of end labels needs beside the plot: the longest label, but never more than about a third of the
 * width.
 */
export function labelGutter({
  labels,
  width,
}: {
  readonly labels: ReadonlyArray<string>;
  readonly width: number;
}): number {
  const longest = Math.max(0, ...labels.map((label) => label.length));

  return Math.min(longest * CHARACTER_WIDTH + LABEL_OFFSET, width * GUTTER_SHARE);
}

/** How many characters fit in a gutter from `labelGutter`. */
export function gutterChars(gutter: number): number {
  return Math.max(1, Math.floor((gutter - LABEL_OFFSET) / CHARACTER_WIDTH));
}

/** Shortens a label to `maxChars`, ending it with an ellipsis. The full name stays in the readout. */
export function truncateLabel(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

/** The room a stack of labels needs, so a plot can grow tall enough to keep every label apart. */
export function labelsHeight(count: number): number {
  return count * LABEL_GAP;
}

export type EndLabel = {
  readonly id: string;
  readonly text: string;
  readonly tone: ChartTone;
  /** Where the line ends, in plot pixels. The label sits there unless a neighbor needs the room. */
  readonly y: number;
};

export type EndLabelsProps = {
  readonly labels: ReadonlyArray<EndLabel>;
  readonly x: number;
  readonly anchor: 'start' | 'end';
  /** The top and bottom of the room the labels may use. */
  readonly top: number;
  readonly bottom: number;
};

/**
 * Names lines where they end. Labels keep their order and move apart just enough that none overlap, so a crowded end
 * reads as a list beside its lines.
 */
export function EndLabels({ labels, x, anchor, top, bottom }: EndLabelsProps): ReactNode {
  const sorted = labels.toSorted((first, second) => first.y - second.y);

  const centers = spreadPositions({
    positions: sorted.map((label) => label.y),
    gap: LABEL_GAP,
    start: top,
    end: bottom,
  });

  const offset = anchor === 'end' ? -LABEL_OFFSET : LABEL_OFFSET;

  return sorted.map((label, index) => (
    <LabelMark
      key={label.id}
      x={x + offset}
      y={(centers[index] ?? label.y) + LABEL_BASELINE}
      anchor={anchor}
      tone={label.tone}
    >
      {label.text}
    </LabelMark>
  ));
}

/** The dashed edge that shows where the keyboard cursor rests on a line. It appears only while the plot has focus. */
export function LineCursor({ d }: { readonly d: string }): ReactNode {
  return <path d={d} {...stylex.props(styles.cursor, chartStyles.shapeCursor)} />;
}
