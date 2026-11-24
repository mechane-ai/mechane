import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
import type { ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import type { SceneStagger } from '../scene-stagger.ts';
import { fillLabel } from '../scene-validate.ts';
import { stackBookOf } from './stack-book.ts';
import { stackBounds } from './stack-layout.ts';
import type { SceneCardSizeName, StackGapName, StackLayout } from './stack-layout.ts';

/** The words a stack speaks when its input is wrong. */
export type SceneStackLabels = {
  /** `{id}` names the stack and `{card}` the card another stack lists too. */
  readonly sharedCard: string;
  /** `{id}` names the stack and `{card}` the card it lists twice. */
  readonly repeatedCard: string;
};

/** The plain English words of a stack. */
export const sceneStackLabels = {
  sharedCard: 'The stack "{id}" lists the card "{card}", which another stack lists too. A card sits in one stack.',
  repeatedCard: 'The stack "{id}" lists the card "{card}" twice.',
} as const satisfies SceneStackLabels;

export type SceneStackProps = {
  /**
   * Stable across states. A wire, group, bracket, callout or the camera can name the stack: as one object it is the box
   * around all its cards.
   */
  readonly id: string;
  /** The anchor in data units: the bottom card of a pile, the middle of a row, column or fan. */
  readonly at: ScenePosition;
  /** The ids of the `SceneCard`s in the stack, in order: bottom of a pile, left of a row, top of a column. */
  readonly cards: ReadonlyArray<string>;
  /** Defaults to `pile`. */
  readonly layout?: StackLayout | undefined;
  /** The room between cards in a row, column or fan. Defaults to `medium`. */
  readonly gap?: StackGapName | undefined;
  /** The card size every card in the stack takes. Defaults to `medium`. */
  readonly size?: SceneCardSizeName | undefined;
  /**
   * Deals in turn: cards that arrive or move in the same update start this step apart, in stack order, and a card that
   * moves alone starts at once. Left out, they all start together.
   */
  readonly stagger?: SceneStagger | undefined;
  /** The readout sentence. With one, the arrow keys reach the stack, which lights all its cards. */
  readonly label?: string | undefined;
  readonly labels?: Partial<SceneStackLabels> | undefined;
};

function repeatedCard(cards: ReadonlyArray<string>): string | undefined {
  return cards.find((card, index) => cards.indexOf(card) !== index);
}

/**
 * Places the cards it lists as a pile, a fan, a row or a column from one anchor, and keeps room in the scene for all of
 * them. Declare it before its cards. Reorder, add or move ids between stacks and the cards ease or travel into place.
 */
export function SceneStack({
  id,
  at,
  cards,
  layout = 'pile',
  gap = 'medium',
  size = 'medium',
  stagger,
  label,
  labels: labelInput,
}: SceneStackProps): ReactNode {
  const scene = useSceneContext();
  const book = stackBookOf(scene.registry);
  const labels = { ...sceneStackLabels, ...labelInput };
  const bounds = stackBounds({ layout, count: cards.length, size, gap });
  const shared = book.sharedCard(id);
  const repeated = repeatedCard(cards);

  const problems = [
    shared === undefined ? undefined : fillLabel(labels.sharedCard, { id, card: shared }),
    repeated === undefined ? undefined : fillLabel(labels.repeatedCard, { id, card: repeated }),
  ];

  book.set(id, { at, layout, size, gap, cards, stagger });

  useLayoutEffect(() => {
    book.flush();
  });

  useLayoutEffect(
    () => () => {
      book.set(id, undefined);
      book.flush();
    },
    [book, id],
  );

  useSceneObject({
    id,
    kind: 'stack',
    frame: { x: at[0], y: at[1], offset: bounds.offset, width: bounds.width, height: bounds.height },
    values: {},
    label,
    attaches: cards,
    problem: problems.find((problem) => problem !== undefined),
  });

  return scene.isInScene ? null : <SceneOutside part="SceneStack" />;
}
