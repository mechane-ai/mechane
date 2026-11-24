import { sceneStore } from './scene-registry.ts';

/** The steps of a stagger by name, in milliseconds. */
export const sceneStaggers = { short: 60, regular: 120, long: 240 } as const;

/** A named stagger step. */
export type SceneStagger = keyof typeof sceneStaggers;

/**
 * How long a change waits on the shared clock before the object starts to move: milliseconds, or a place in a stagger,
 * where `{ index: 2, step: 'regular' }` waits two regular steps. Reduced motion and the `instant` pace never wait.
 */
export type SceneDelay = number | { readonly index: number; readonly step?: SceneStagger | undefined };

/**
 * An object's place in a stagger group. When several members of one group change in the same update, they start one
 * step apart in `index` order; a member that changes alone starts at once.
 */
export type SceneStaggerPlace = {
  /** Names the group. A stack's cards use the stack's id. */
  readonly group: string;
  /** The place in the group's order: lower starts first. */
  readonly index: number;
  /** The wait between two members that start one after another. Defaults to `regular`. */
  readonly step?: SceneStagger | undefined;
};

/** The milliseconds a delay waits. */
export function delayOf(delay: SceneDelay): number {
  return typeof delay === 'number' ? delay : delay.index * sceneStaggers[delay.step ?? 'regular'];
}

type Entry = {
  readonly place: SceneStaggerPlace;
  /** Starts the member's move after `wait` milliseconds of stagger. */
  readonly begin: (wait: number) => void;
};

/** The members of each group that changed in the update being committed, started together once it is committed. */
type Staggers = {
  /** Adds a changed member to this update's batch of its group. Returns the function that takes it out again. */
  readonly join: (entry: Entry) => () => void;
};

function createStaggers(): Staggers {
  const batch = new Set<Entry>();
  const state = { isQueued: false };

  function start(): void {
    state.isQueued = false;

    const groups = Map.groupBy(batch, (entry) => entry.place.group);

    batch.clear();

    const starts = Array.from(groups.values()).flatMap((members) =>
      members
        .toSorted((first, second) => first.place.index - second.place.index)
        .map((entry, position) => ({ entry, wait: position * sceneStaggers[entry.place.step ?? 'regular'] })),
    );

    for (const { entry, wait } of starts) {
      entry.begin(wait);
    }
  }

  return {
    join: (entry) => {
      batch.add(entry);

      if (!state.isQueued) {
        state.isQueued = true;

        queueMicrotask(start);
      }

      return () => {
        batch.delete(entry);
      };
    },
  };
}

/** The stagger batches of a scene. Every member's layout effect in one commit runs before the batch starts. */
export const staggersOf = sceneStore(createStaggers);
