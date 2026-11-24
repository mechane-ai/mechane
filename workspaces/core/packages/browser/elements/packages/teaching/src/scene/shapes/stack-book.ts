import type { ScenePosition } from '../scene-geometry.ts';
import { sceneStore } from '../scene-registry.ts';
import type { SceneStagger } from '../scene-stagger.ts';
import type { SceneCardSizeName, StackGapName, StackLayout } from './stack-layout.ts';

/** What a stack tells the cards it lists. */
export type StackSpec = {
  readonly at: ScenePosition;
  readonly layout: StackLayout;
  readonly size: SceneCardSizeName;
  readonly gap: StackGapName;
  /** The ids of the cards in order: the bottom of a pile first, the left of a row first. */
  readonly cards: ReadonlyArray<string>;
  /** The step between cards that move in the same update, or undefined when they all start at once. */
  readonly stagger: SceneStagger | undefined;
};

/** Where a card sits: the stack that lists it and its place in that stack's order. */
export type StackSlot = { readonly stackId: string; readonly spec: StackSpec; readonly index: number };

/** The scene's record of its stacks, so a card finds its place without being nested inside its stack. */
export type StackBook = {
  /** Records a stack without telling anyone, so cards rendered after it in one pass see it. Undefined removes it. */
  readonly set: (id: string, spec: StackSpec | undefined) => void;
  /** Tells the cards that a stack changed since the last flush. Call it from a layout effect. */
  readonly flush: () => void;
  readonly slotOf: (cardId: string) => StackSlot | undefined;
  /** A card that this stack lists and another stack lists too, or undefined. */
  readonly sharedCard: (stackId: string) => string | undefined;
  /** Changes whenever a flush tells the cards something. Use it as the store snapshot. */
  readonly version: () => number;
  readonly subscribe: (listener: () => void) => () => void;
};

function createStackBook(): StackBook {
  const specs = new Map<string, StackSpec>();
  const keys = new Map<string, string>();
  const listeners = new Set<() => void>();
  const state = { isDirty: false, version: 0 };

  function slotOf(cardId: string): StackSlot | undefined {
    for (const [stackId, spec] of specs) {
      const index = spec.cards.indexOf(cardId);

      if (index !== -1) {
        return { stackId, spec, index };
      }
    }

    return undefined;
  }

  return {
    set: (id, spec) => {
      if (spec === undefined) {
        state.isDirty = specs.delete(id) || state.isDirty;

        keys.delete(id);

        return;
      }

      const key = JSON.stringify(spec);

      if (keys.get(id) === key) {
        return;
      }

      keys.set(id, key);
      specs.set(id, spec);

      state.isDirty = true;
    },
    flush: () => {
      if (!state.isDirty) {
        return;
      }

      state.isDirty = false;
      state.version += 1;

      for (const listener of listeners) {
        listener();
      }
    },
    slotOf,
    sharedCard: (stackId) =>
      specs.get(stackId)?.cards.find((card) => {
        const slot = slotOf(card);

        return slot !== undefined && slot.stackId !== stackId;
      }),
    version: () => state.version,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The stack book of a scene, made on first use and kept as long as the scene's registry lives. */
export const stackBookOf = sceneStore(createStackBook);
