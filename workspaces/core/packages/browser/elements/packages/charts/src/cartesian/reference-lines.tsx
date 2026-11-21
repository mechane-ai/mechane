import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { hasUniqueIds } from '../chart-input.tsx';
import { chartStyles } from '../chart-theme.ts';
import { spreadPositions } from '../label-spacing.ts';

/**
 * A labelled value drawn across the plot, such as a target or a period average. The application supplies the value and
 * its meaning; the chart neither computes nor ranks it.
 */
export type ChartReferenceLine = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  /** Colors the line. Absent means the neutral tone; the label always uses text colors. */
  readonly tone?: ChartTone | undefined;
};

const styles = stylex.create({
  line: (color: string) => ({
    stroke: color,
    strokeWidth: 1.5,
    strokeDasharray: '5 4',
    vectorEffect: 'non-scaling-stroke',
  }),
  leader: (color: string) => ({ stroke: color, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' }),
});

const LABEL_BLOCK_PX = 30;
const LABEL_LINE_PX = 13;
const LABEL_INSET_PX = 8;
const LEADER_PX = 4;
const CHARACTER_WIDTH_PX = 6.5;
const GUTTER_MIN_PX = 40;
const GUTTER_MAX_PX = 112;
const LABEL_CHARACTERS_MAX = 16;

const REFERENCE_LINES_MAX = 8;

export function validateReferenceLines({
  lines,
  domain,
}: {
  readonly lines: ReadonlyArray<ChartReferenceLine>;
  readonly domain: readonly [number, number];
}): string | undefined {
  if (lines.length > REFERENCE_LINES_MAX) {
    return `Supply at most ${REFERENCE_LINES_MAX} reference lines.`;
  }

  if (!hasUniqueIds(lines)) {
    return 'Reference lines require unique identifiers.';
  }

  for (const line of lines) {
    const isInside = Number.isFinite(line.value) && line.value >= domain[0] && line.value <= domain[1];

    if (!isInside || line.label.trim() === '') {
      return 'Each reference line needs a label and a finite value inside the value domain.';
    }
  }

  return undefined;
}

function shortLabel(label: string): string {
  return label.length > LABEL_CHARACTERS_MAX ? `${label.slice(0, LABEL_CHARACTERS_MAX - 1)}…` : label;
}

/** The right gutter that holds reference labels, or zero when the plot has none. */
export function referenceGutterWidth({
  lines,
  formatValue,
}: {
  readonly lines: ReadonlyArray<ChartReferenceLine>;
  readonly formatValue: (value: number) => string;
}): number {
  if (lines.length === 0) {
    return 0;
  }

  const characters = Math.max(
    ...lines.map((line) => Math.max(shortLabel(line.label).length, formatValue(line.value).length)),
  );

  return Math.min(GUTTER_MAX_PX, Math.max(GUTTER_MIN_PX, characters * CHARACTER_WIDTH_PX)) + LABEL_INSET_PX;
}

type ReferenceLinesProps = {
  readonly lines: ReadonlyArray<ChartReferenceLine>;
  readonly y: (value: number) => number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly formatValue: (value: number) => string;
};

type PlacedLabel = { readonly line: ChartReferenceLine; readonly position: number; readonly center: number };

/** Spaces label blocks at least one block apart, nearest their lines, inside the plot's vertical bounds. */
function placeLabels({
  lines,
  y,
  top,
  bottom,
}: Pick<ReferenceLinesProps, 'lines' | 'y' | 'top' | 'bottom'>): ReadonlyArray<PlacedLabel> {
  const ordered = lines
    .map((line) => ({ line, position: y(line.value) }))
    .toSorted((first, second) => first.position - second.position);

  const centers = spreadPositions({
    positions: ordered.map((item) => item.position),
    gap: LABEL_BLOCK_PX,
    start: top + LABEL_BLOCK_PX / 2,
    end: bottom - LABEL_BLOCK_PX / 2,
  });

  return ordered.map((item, index) => ({ ...item, center: centers[index] ?? item.position }));
}

/** Draws dashed reference lines across the plot and names each one in the right gutter beside its line. */
export function ReferenceLines({ lines, y, left, right, top, bottom, formatValue }: ReferenceLinesProps): ReactNode {
  return (
    <g>
      {placeLabels({ lines, y, top, bottom }).map(({ line, position, center }) => {
        const color = chartToneColors[line.tone ?? 'neutral'];
        const labelX = right + LABEL_INSET_PX;

        return (
          <g key={line.id}>
            <line x1={left} x2={right} y1={position} y2={position} {...stylex.props(styles.line(color))} />
            <path
              d={`M${right},${position} L${right + LEADER_PX},${center} H${right + LEADER_PX + 1}`}
              fill="none"
              {...stylex.props(styles.leader(color))}
            />
            <text x={labelX} y={center - 2} {...stylex.props(chartStyles.label, chartStyles.strongLabel)}>
              {shortLabel(line.label)}
            </text>
            <text x={labelX} y={center + LABEL_LINE_PX - 2} {...stylex.props(chartStyles.label)}>
              {formatValue(line.value)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
