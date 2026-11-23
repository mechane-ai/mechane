/** A text label placed in a plot, with the position its text is centered on. */
export type PlacedLabel = { readonly id: string; readonly text: string; readonly x: number; readonly y: number };

/** The average width of a caption character in the body face, in pixels. */
const CHARACTER_WIDTH = 6.5;
const LINE_HEIGHT = 14;
const LABEL_GAP = 6;
const HALF = 0.5;

/** True when two labels would touch: their text spans overlap across and their lines overlap down. */
function collides(first: PlacedLabel, second: PlacedLabel): boolean {
  const reach = (first.text.length + second.text.length) * CHARACTER_WIDTH * HALF + LABEL_GAP;

  return Math.abs(first.x - second.x) < reach && Math.abs(first.y - second.y) < LINE_HEIGHT;
}

/**
 * The labels that fit without touching, in priority order: a label stays only when it clears every label ranked before
 * it. A label left out keeps its text in the readout and the exact-value table, so thinning never hides a value.
 */
export function clearLabels<Label extends PlacedLabel>(byPriority: ReadonlyArray<Label>): ReadonlyArray<Label> {
  return byPriority.filter((label, index) => byPriority.slice(0, index).every((other) => !collides(label, other)));
}

/** Where a centered label sits so it stays between two bounds, and which end it is anchored to there. */
export function labelInside({
  x,
  text,
  left,
  right,
}: {
  readonly x: number;
  readonly text: string;
  readonly left: number;
  readonly right: number;
}): { readonly x: number; readonly anchor: 'start' | 'middle' | 'end' } {
  const half = text.length * CHARACTER_WIDTH * HALF;

  if (x - half < left) {
    return { x: left, anchor: 'start' };
  }

  return x + half > right ? { x: right, anchor: 'end' } : { x, anchor: 'middle' };
}
