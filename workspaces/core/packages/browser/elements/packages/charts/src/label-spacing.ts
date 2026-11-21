type SpreadInput = {
  /** Preferred centers in ascending order. */
  readonly positions: ReadonlyArray<number>;
  /** The least distance between neighboring centers. */
  readonly gap: number;
  readonly start: number;
  readonly end: number;
};

/**
 * Moves label centers apart by at least `gap`, as near their preferred positions as the bounds allow, keeping their
 * order. When the labels cannot all fit, the first ones keep the start bound. Each center is the closed form of three
 * passes: push labels down, pull them back above the end, then push once more.
 */
export function spreadPositions({ positions, gap, start, end }: SpreadInput): ReadonlyArray<number> {
  const last = positions.length - 1;

  const pushed = positions.map((_, index) =>
    Math.max(
      start + index * gap,
      ...positions.slice(0, index + 1).map((position, from) => position + (index - from) * gap),
    ),
  );

  const pulled = pushed.map((_, index) =>
    Math.min(end - (last - index) * gap, ...pushed.slice(index).map((center, offset) => center - offset * gap)),
  );

  return pulled.map((_, index) =>
    Math.max(start + index * gap, ...pulled.slice(0, index + 1).map((center, from) => center + (index - from) * gap)),
  );
}
