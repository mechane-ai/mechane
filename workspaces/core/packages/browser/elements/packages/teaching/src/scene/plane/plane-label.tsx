import type { ReactNode } from 'react';
import { LabelMark } from '../../../../charts/src/plot/index.ts';
import type { LabelObstacle, LabelSpot } from '../../../../charts/src/plot/index.ts';
import { usePlacedLabel } from '../scene-obstacles.ts';

const LABEL_GAP = 11;
const LABEL_DROP = 16;
const TEXT_BASELINE = 4;

/** The places a label may go around a mark at a position, in order of preference: beside it, then above or below. */
export function spotsAround({
  x,
  y,
  text,
}: {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}): ReadonlyArray<LabelSpot> {
  return [
    { x: x + LABEL_GAP, y: y - LABEL_GAP, anchor: 'start', text },
    { x: x + LABEL_GAP, y: y + LABEL_DROP, anchor: 'start', text },
    { x: x - LABEL_GAP, y: y - LABEL_GAP, anchor: 'end', text },
    { x: x - LABEL_GAP, y: y + LABEL_DROP, anchor: 'end', text },
    { x, y: y - LABEL_GAP - TEXT_BASELINE, anchor: 'middle', text },
    { x, y: y + LABEL_DROP + TEXT_BASELINE, anchor: 'middle', text },
    { x: x + LABEL_GAP, y: y + TEXT_BASELINE, anchor: 'start', text },
    { x: x - LABEL_GAP, y: y + TEXT_BASELINE, anchor: 'end', text },
  ];
}

/**
 * A part's short text in the plot. It takes the first of `spots` that stays inside the plot and touches no other part
 * and no label placed before it. Failing that, it takes the one that touches least.
 */
export function PlaneLabel({
  owner,
  name,
  spots,
  lines = [],
  isStrong = false,
}: {
  /** The id of the part the text belongs to. Its own lines are not avoided; pass the ones to avoid in `lines`. */
  readonly owner: string;
  /** Tells apart the labels of one part. */
  readonly name: string;
  /** Where the text may go, in order of preference. */
  readonly spots: ReadonlyArray<LabelSpot>;
  /** Extra lines to keep clear of, in plot pixels. A single point stands for a dot. */
  readonly lines?: ReadonlyArray<ReadonlyArray<LabelObstacle>> | undefined;
  readonly isStrong?: boolean | undefined;
}): ReactNode {
  const spot = usePlacedLabel({ id: `${owner}:${name}`, owner, spots, lines });

  if (spot === undefined) {
    return null;
  }

  return (
    <LabelMark x={spot.x} y={spot.y} anchor={spot.anchor} isStrong={isStrong}>
      {spot.text}
    </LabelMark>
  );
}
