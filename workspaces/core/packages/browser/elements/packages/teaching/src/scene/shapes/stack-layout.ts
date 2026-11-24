import type { SceneOffset } from '../scene-geometry.ts';

/** The pixel boxes of the named card sizes, in playing-card proportions. */
export const sceneCardSizes = {
  small: { width: 56, height: 78 },
  medium: { width: 84, height: 118 },
  large: { width: 144, height: 202 },
} as const;

/** A named card size. */
export type SceneCardSizeName = keyof typeof sceneCardSizes;

/** The room between cards in a row, a column or a fan, by name, in CSS pixels. */
export const stackGaps = { small: 4, medium: 12, large: 24 } as const;

/** A named gap between the cards of a stack. */
export type StackGapName = keyof typeof stackGaps;

/**
 * How a stack arranges its cards: stacked with a small step, overlapped along an arc, side by side, or one under
 * another.
 */
export type StackLayout = 'pile' | 'fan' | 'row' | 'column';

/** What `stackOffset` and `stackBounds` need to know about a stack. */
export type StackShape = {
  readonly layout: StackLayout;
  /** How many cards the stack holds. */
  readonly count: number;
  readonly size: SceneCardSizeName;
  readonly gap: StackGapName;
};

/** Where one card of a stack sits: its shift from the stack's anchor in pixels, and its turn in degrees. */
export type StackPlace = { readonly offset: SceneOffset; readonly rotate: number };

const PILE = { depthMax: 8, across: 1.5, up: 2 } as const;
const FAN = { overlap: 0.3, arc: 12, turn: 14 } as const;
const HALF = 0.5;
const HALF_TURN = 180;
const RADIANS_PER_DEGREE = Math.PI / HALF_TURN;

/**
 * Where the card at `index` sits in a stack. A pile grows up and right from its bottom card; a row or column is
 * centered on it, and a fan turns its cards out along an arc. The first card is the bottom of a pile, the left of a row
 * or fan, and the top of a column.
 */
export function stackPlace({ layout, count, size, gap, index }: StackShape & { readonly index: number }): StackPlace {
  const box = sceneCardSizes[size];
  const space = stackGaps[gap];
  const middle = (Math.max(count, 1) - 1) * HALF;
  const centered = index - middle;

  switch (layout) {
    case 'pile': {
      const depth = Math.min(index, PILE.depthMax);

      return { offset: [depth * PILE.across, -depth * PILE.up], rotate: 0 };
    }

    case 'row':
      return { offset: [centered * (box.width + space), 0], rotate: 0 };

    case 'column':
      return { offset: [0, centered * (box.height + space)], rotate: 0 };

    case 'fan': {
      const fraction = middle === 0 ? 0 : centered / middle;

      return {
        offset: [centered * (box.width * FAN.overlap + space), FAN.arc * fraction * fraction],
        rotate: FAN.turn * fraction,
      };
    }
  }
}

/** The pixel box around a whole stack: its center's shift from the anchor and its size. */
export type StackBounds = { readonly offset: SceneOffset; readonly width: number; readonly height: number };

/**
 * The box around every card of a stack, turned cards included, so a wire, a group, a bracket or the camera can address
 * the stack as one object. An empty stack is one card's box.
 */
export function stackBounds(shape: StackShape): StackBounds {
  const box = sceneCardSizes[shape.size];

  const cards = Array.from({ length: Math.max(shape.count, 1) }, (_, index) => {
    const { offset, rotate } = stackPlace({ ...shape, index });
    const cos = Math.abs(Math.cos(rotate * RADIANS_PER_DEGREE));
    const sin = Math.abs(Math.sin(rotate * RADIANS_PER_DEGREE));
    const across = (box.width * cos + box.height * sin) * HALF;
    const down = (box.width * sin + box.height * cos) * HALF;

    return { left: offset[0] - across, right: offset[0] + across, top: offset[1] - down, bottom: offset[1] + down };
  });

  const left = Math.min(...cards.map((card) => card.left));
  const right = Math.max(...cards.map((card) => card.right));
  const top = Math.min(...cards.map((card) => card.top));
  const bottom = Math.max(...cards.map((card) => card.bottom));

  return { offset: [(left + right) * HALF, (top + bottom) * HALF], width: right - left, height: bottom - top };
}
