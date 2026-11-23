/** A label a chart could draw: where its baseline starts, how it is anchored, and its text. */
export type LabelSpot = {
  readonly x: number;
  /** The text's baseline. */
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
  readonly text: string;
};

/** A point in plot pixels on a line a label must avoid. */
export type LabelObstacle = { readonly x: number; readonly y: number };

/** A box in plot pixels. */
export type LabelBox = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };

const CHARACTER_WIDTH = 7;
const ASCENT = 11;
const DESCENT = 3;
const CLEARANCE = 3;
const SAMPLES_PER_SEGMENT = 8;
const HALF = 0.5;

const anchorShare = { start: 0, middle: HALF, end: 1 } as const;

/** The box a label's text covers, with a few pixels of clearance on every side. */
export function labelBox(spot: LabelSpot): LabelBox {
  const width = spot.text.length * CHARACTER_WIDTH;
  const left = spot.x - width * anchorShare[spot.anchor];

  return {
    left: left - CLEARANCE,
    right: left + width + CLEARANCE,
    top: spot.y - ASCENT - CLEARANCE,
    bottom: spot.y + DESCENT + CLEARANCE,
  };
}

function holds(box: LabelBox, point: LabelObstacle): boolean {
  const isBetweenSides = point.x >= box.left && point.x <= box.right;
  const isBetweenEnds = point.y >= box.top && point.y <= box.bottom;

  return isBetweenSides && isBetweenEnds;
}

/** How many of the lines run through a box. A line is tested along each segment, not only at its points. */
function crossings(box: LabelBox, lines: ReadonlyArray<ReadonlyArray<LabelObstacle>>): number {
  return lines.filter((line) =>
    line.some((point, index) => {
      const next = line[index + 1];

      if (next === undefined) {
        return holds(box, point);
      }

      if (Math.max(point.x, next.x) < box.left || Math.min(point.x, next.x) > box.right) {
        return false;
      }

      return Array.from({ length: SAMPLES_PER_SEGMENT + 1 }, (_, step) => step / SAMPLES_PER_SEGMENT).some((share) =>
        holds(box, { x: point.x + (next.x - point.x) * share, y: point.y + (next.y - point.y) * share }),
      );
    }),
  ).length;
}

export type FreeLabelSpotInput = {
  /** Where the label may go, in order of preference. */
  readonly spots: ReadonlyArray<LabelSpot>;
  /** The lines and marks the label must not sit on, as pixel polylines. A single point stands for a dot. */
  readonly lines: ReadonlyArray<ReadonlyArray<LabelObstacle>>;
  /** Boxes already taken, such as other labels. */
  readonly taken?: ReadonlyArray<LabelBox> | undefined;
};

/**
 * The first spot where a label touches no line and no taken box, or else the spot it touches least. Use it for a
 * reference or marker label that may sit at either end of its line, so it never covers a series.
 */
export function freeLabelSpot({ spots, lines, taken = [] }: FreeLabelSpotInput): LabelSpot | undefined {
  const scored = spots.map((spot) => {
    const box = labelBox(spot);

    const overlaps = taken.filter((other) => {
      const isOverlappingAcross = box.left < other.right && other.left < box.right;
      const isOverlappingDown = box.top < other.bottom && other.top < box.bottom;

      return isOverlappingAcross && isOverlappingDown;
    }).length;

    return { spot, score: crossings(box, lines) + overlaps };
  });

  return (
    scored.find((item) => item.score === 0)?.spot ??
    scored.toSorted((first, second) => first.score - second.score)[0]?.spot
  );
}
