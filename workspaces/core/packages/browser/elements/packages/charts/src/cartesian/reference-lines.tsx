import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { hasUniqueIds } from '../chart-input.ts';
import { spreadPositions } from '../label-spacing.ts';
import { freeLabelSpot, labelBox } from '../plot/label-place.ts';
import type { LabelBox, LabelObstacle } from '../plot/label-place.ts';
import type { PlotBox } from '../plot/plot-layout.ts';
import { LabelMark, RuleMark } from '../plot/plot-marks.tsx';
import { outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import type { PlacedLabel } from './value-labels.ts';

/**
 * A labelled value drawn across the plot, such as a target or a period average. The application supplies the value and
 * its meaning; the chart neither computes nor ranks it.
 */
export type ChartReferenceLine = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  /** Colors the line. Absent means ink; the label always uses text colors. */
  readonly tone?: ChartTone | undefined;
};

const REFERENCE_LINES_MAX = 8;
const LABEL_LIFT = 6;
const LABEL_INSET = 6;
const LABEL_LINE = 14;
/** Where along its line a label may also sit, as shares of the plot width, when neither end is clear. */
const ALONG_SHARES = [0.75, 0.25, 0.5, 0.875, 0.125, 0.625, 0.375] as const;

/** Why reference lines cannot be drawn on a value axis, or undefined when they can. */
export function validateReferenceLines({
  lines,
  domain,
}: {
  readonly lines: ReadonlyArray<ChartReferenceLine>;
  readonly domain: NumericDomain;
}): string | undefined {
  if (lines.length > REFERENCE_LINES_MAX) {
    return `Supply at most ${REFERENCE_LINES_MAX} reference lines.`;
  }

  if (!hasUniqueIds(lines)) {
    return 'Reference lines require unique identifiers.';
  }

  for (const line of lines) {
    if (outsideDomain(line.value, domain) || line.label.trim() === '') {
      return 'Each reference line needs a label and a finite value inside the value domain.';
    }
  }

  return undefined;
}

/**
 * Dashed reference lines across a plot, each named with its exact value. A label sits above its line at the plot's
 * right end, or else at the left end, or else further along the line, then below it. It takes the first place that
 * clears the chart's own value labels and the marks it is given, and labels that would touch are spread apart
 * vertically, never dropped.
 */
export function ReferenceMarks({
  lines,
  box,
  position,
  valueText,
  avoid = [],
  marks = [],
  obstacles = [],
}: {
  readonly lines: ReadonlyArray<ChartReferenceLine>;
  readonly box: PlotBox;
  /** Where a value sits on the plot's value axis. */
  readonly position: (value: number) => number;
  readonly valueText: (value: number) => string;
  /** Labels the chart draws in the plot, such as a column's value, that a reference label must not cover. */
  readonly avoid?: ReadonlyArray<PlacedLabel> | undefined;
  /** The boxes of marks a reference label must not sit on, such as the columns of a bridge. */
  readonly marks?: ReadonlyArray<LabelBox> | undefined;
  /** The lines a reference label must not sit on, such as a chart's series, as pixel polylines. */
  readonly obstacles?: ReadonlyArray<ReadonlyArray<LabelObstacle>> | undefined;
}): ReactNode {
  const ordered = lines
    .map((line) => ({ line, y: position(line.value) }))
    .toSorted((first, second) => first.y - second.y);

  const baselines = spreadPositions({
    positions: ordered.map((item) => item.y - LABEL_LIFT),
    gap: LABEL_LINE,
    start: box.top,
    end: box.bottom,
  });

  const taken = [
    ...avoid.map((label) => labelBox({ x: label.x, y: label.y, anchor: 'middle', text: label.text })),
    ...marks,
  ];

  return (
    <g>
      {ordered.map(({ line, y }, index) => {
        const text = `${line.label} ${valueText(line.value)}`;
        const baseline = baselines[index] ?? y - LABEL_LIFT;
        const below = y + LABEL_LINE;
        const right = box.right - LABEL_INSET;
        const left = box.left + LABEL_INSET;

        const along = ALONG_SHARES.map((share) => box.left + box.innerWidth * share);

        const spot = freeLabelSpot({
          spots: [baseline, below].flatMap((level) => [
            { x: right, y: level, anchor: 'end' as const, text },
            { x: left, y: level, anchor: 'start' as const, text },
            ...along.map((x) => ({ x, y: level, anchor: 'middle' as const, text })),
          ]),
          lines: obstacles,
          taken,
        }) ?? { x: right, y: baseline, anchor: 'end', text };

        return (
          <g key={line.id}>
            <RuleMark x1={box.left} x2={box.right} y1={y} y2={y} stroke="dashed" tone={line.tone} />
            <LabelMark x={spot.x} y={spot.y} anchor={spot.anchor}>
              {text}
            </LabelMark>
          </g>
        );
      })}
    </g>
  );
}
