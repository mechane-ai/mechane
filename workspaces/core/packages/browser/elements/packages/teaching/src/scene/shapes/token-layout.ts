import type { SceneOffset } from '../scene-geometry.ts';

/** How wide one character of the token face is, in CSS pixels, for sizing a token's box before it is drawn. */
const CHARACTER_WIDTH = 7.4;
const PADDING = 16;
const WIDTH_MIN = 36;
const WIDTH_MAX = 176;
const HEIGHT_ONE_LINE = 28;
const HEIGHT_TWO_LINES = 44;
const HALF = 0.5;

/** The pixels between neighbouring tokens, by name. */
export const tokenGaps = { small: 4, medium: 8, large: 16 } as const;

/** A named gap between tokens. */
export type TokenGapName = keyof typeof tokenGaps;

/** What decides a token's box: its text, and the text under it. */
export type TokenBoxInput = { readonly text: string; readonly caption: string | undefined };

/** The pixel box of a token: wide enough for its characters, capped, and taller when a line sits under the text. */
export function tokenBox({ text, caption }: TokenBoxInput): { readonly width: number; readonly height: number } {
  const characters = Math.max(Array.from(text).length, Array.from(caption ?? '').length);

  return {
    width: Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.ceil(characters * CHARACTER_WIDTH + PADDING))),
    height: caption === undefined ? HEIGHT_ONE_LINE : HEIGHT_TWO_LINES,
  };
}

/** Each token's center as a shift in pixels from the block's center, and the block's size. */
export type TokenFlow = {
  readonly offsets: ReadonlyArray<SceneOffset>;
  readonly width: number;
  readonly height: number;
};

type TokenBox = { readonly width: number; readonly height: number };

function total(values: ReadonlyArray<number>): number {
  const sum = { value: 0 };

  for (const value of values) {
    sum.value += value;
  }

  return sum.value;
}

function rowWidth(boxes: ReadonlyArray<TokenBox>, space: number): number {
  return total(boxes.map((box) => box.width)) + Math.max(boxes.length - 1, 0) * space;
}

/** The indices of each row: as many tokens as fit within `wrapWidth`, and always at least one. */
function tokenRows({
  boxes,
  wrapWidth,
  space,
}: {
  readonly boxes: ReadonlyArray<TokenBox>;
  readonly wrapWidth: number;
  readonly space: number;
}): ReadonlyArray<ReadonlyArray<number>> {
  const state: { start: number; rows: ReadonlyArray<ReadonlyArray<number>> } = { start: 0, rows: [] };

  while (state.start < boxes.length) {
    const rest = boxes.slice(state.start);
    const fits = rest.map((_, count) => rowWidth(rest.slice(0, count + 1), space) <= wrapWidth);
    const firstMiss = fits.indexOf(false);
    const count = Math.max(1, firstMiss === -1 ? fits.length : firstMiss);

    state.rows = [...state.rows, Array.from({ length: count }, (_, at) => state.start + at)];
    state.start += count;
  }

  return state.rows;
}

/**
 * Lays token boxes out left to right and wraps to a new row when the next would pass `wrapWidth`. Rows are as tall as
 * their tallest token. Offsets are from the block's center, so a block keeps its center as tokens come and go.
 */
export function tokenFlow({
  boxes,
  wrapWidth,
  gap,
}: {
  readonly boxes: ReadonlyArray<TokenBox>;
  readonly wrapWidth: number;
  readonly gap: TokenGapName;
}): TokenFlow {
  const space = tokenGaps[gap];
  const rows = tokenRows({ boxes, wrapWidth, space });
  const heights = rows.map((row) => Math.max(...row.map((index) => boxes[index]?.height ?? 0)));

  const width = Math.max(
    0,
    ...rows.map((row) =>
      rowWidth(
        row.map((index) => boxes[index] ?? { width: 0, height: 0 }),
        space,
      ),
    ),
  );

  const height = total(heights) + Math.max(rows.length - 1, 0) * space;

  const offsets = boxes.map((box, index) => {
    const rowIndex = rows.findIndex((row) => row.includes(index));
    const row = rows[rowIndex] ?? [];
    const before = total(row.slice(0, row.indexOf(index)).map((at) => (boxes[at]?.width ?? 0) + space));
    const top = total(heights.slice(0, rowIndex).map((rowHeight) => rowHeight + space));

    return [before + box.width * HALF - width * HALF, top + (heights[rowIndex] ?? 0) * HALF - height * HALF] as const;
  });

  return { offsets, width, height };
}
