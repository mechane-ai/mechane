import { useLayoutEffect, useSyncExternalStore } from 'react';
import { freeLabelSpot, labelBox } from '../../../charts/src/plot/index.ts';
import type { LabelObstacle, LabelSpot } from '../../../charts/src/plot/index.ts';
import { useSceneContext } from './scene-context.ts';
import type { SceneDataPoint, ScenePixel, SceneRect } from './scene-geometry.ts';
import { sceneStore } from './scene-registry.ts';

/**
 * What the text of one scene keeps clear of. It holds the lines of other parts, in data units so the camera does not
 * move them, and the boxes of labels and callouts already placed. Text keeps clear of the text placed before it.
 */
type Obstacles = {
  readonly set: (id: string, line: ReadonlyArray<SceneDataPoint> | null) => void;
  readonly claim: (id: string, box: SceneRect | null) => void;
  readonly lines: (except: string | undefined) => ReadonlyArray<ReadonlyArray<SceneDataPoint>>;
  readonly taken: (id: string) => ReadonlyArray<SceneRect>;
  readonly version: () => number;
  readonly subscribe: (listener: () => void) => () => void;
};

function isSameBox(first: SceneRect, second: SceneRect): boolean {
  const isSameRow = first.left === second.left && first.right === second.right;

  return isSameRow && first.top === second.top && first.bottom === second.bottom;
}

function createObstacles(): Obstacles {
  const held = new Map<string, ReadonlyArray<SceneDataPoint>>();
  const boxes = new Map<string, SceneRect>();
  const listeners = new Set<() => void>();
  const state = { version: 0 };

  function changed(): void {
    state.version += 1;

    for (const listener of listeners) {
      listener();
    }
  }

  return {
    set: (id, line) => {
      if (line === null) {
        held.delete(id);
      } else {
        held.set(id, line);
      }

      changed();
    },
    claim: (id, box) => {
      const known = boxes.get(id);

      if (box === null) {
        if (boxes.delete(id)) {
          changed();
        }

        return;
      }

      if (known === undefined || !isSameBox(known, box)) {
        boxes.set(id, box);
        changed();
      }
    },
    lines: (except) => Array.from(held, ([id, line]) => (id === except ? [] : [line])).flat(),
    taken: (id) => {
      const entries = Array.from(boxes);
      const own = entries.findIndex(([key]) => key === id);

      return (own === -1 ? entries : entries.slice(0, own)).map(([, box]) => box);
    },
    version: () => state.version,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const obstaclesOf = sceneStore(createObstacles);

/** Tells the scene's labels where this line runs, so none sits on it. Call it from a part that draws a line or dot. */
export function useObstacle({ id, line }: { readonly id: string; readonly line: ReadonlyArray<SceneDataPoint> }): void {
  const { registry } = useSceneContext();
  const store = obstaclesOf(registry);

  useLayoutEffect(() => {
    store.set(id, line);
  });

  useLayoutEffect(
    () => () => {
      store.set(id, null);
    },
    [store, id],
  );
}

/**
 * The lines other parts registered, in plot pixels as the camera shows them now, leaving out those of `owner`. A part's
 * text and a callout keep clear of them.
 */
export function useObstacleLines(owner: string | undefined): ReadonlyArray<ReadonlyArray<ScenePixel>> {
  const scene = useSceneContext();
  const store = obstaclesOf(scene.registry);

  useSyncExternalStore(store.subscribe, store.version, store.version);

  return store
    .lines(owner)
    .map((line) => line.map((point) => ({ x: scene.x.position(point.x), y: scene.y.position(point.y) })));
}

/** The boxes of the text placed before this claim, which it keeps clear of. A claim's place is its first render. */
export function useTakenBoxes(id: string): ReadonlyArray<SceneRect> {
  const { registry } = useSceneContext();
  const store = obstaclesOf(registry);

  useSyncExternalStore(store.subscribe, store.version, store.version);

  return store.taken(id);
}

/** Claims `box` for this text, so the labels and callouts placed after it keep clear of it. Null claims nothing. */
export function useClaimedBox(id: string, box: SceneRect | null): void {
  const { registry } = useSceneContext();
  const store = obstaclesOf(registry);

  useLayoutEffect(() => {
    store.claim(id, box);
  });

  useLayoutEffect(
    () => () => {
      store.claim(id, null);
    },
    [store, id],
  );
}

/** Where a part's text goes, and the claim that keeps later labels off it. */
export function usePlacedLabel({
  id,
  owner,
  spots,
  lines,
}: {
  /** Names this label among all the scene's labels. */
  readonly id: string;
  /** The id of the part the text belongs to. Its own registered lines are not avoided. */
  readonly owner: string;
  /** Where the text may go, in order of preference. */
  readonly spots: ReadonlyArray<LabelSpot>;
  /** Extra lines to keep clear of, in plot pixels. */
  readonly lines: ReadonlyArray<ReadonlyArray<LabelObstacle>>;
}): LabelSpot | undefined {
  const { box } = useSceneContext();
  const others = useObstacleLines(owner);
  const taken = useTakenBoxes(id);

  const inside = spots.filter((spot) => {
    const covered = labelBox(spot);
    const isAcross = covered.left >= box.left && covered.right <= box.right;

    return isAcross && covered.top >= box.top && covered.bottom <= box.bottom;
  });

  const spot = freeLabelSpot({ spots: inside.length > 0 ? inside : spots, lines: [...others, ...lines], taken });

  useClaimedBox(id, spot === undefined ? null : labelBox(spot));

  return spot;
}
