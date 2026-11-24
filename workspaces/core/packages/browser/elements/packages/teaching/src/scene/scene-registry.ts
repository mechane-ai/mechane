import type { SceneFrame, SceneMargins, SceneOffset, SceneShape } from './scene-geometry.ts';

/**
 * The eased numbers every scene object has: its center in data units, its pixel shift from there (`dx` across, `dy`
 * down), its pixel size, and how visible it is.
 */
export type SceneFrameKey = 'x' | 'y' | 'dx' | 'dy' | 'width' | 'height' | 'opacity';

/** One object's geometry as it is on screen in this frame. */
export type SceneFrameValues = Readonly<Record<SceneFrameKey, number>>;

/** Read access to one object's animated geometry, for the parts that follow it, such as wires and groups. */
export type SceneTrack = {
  /** The geometry on screen now. The same object is returned until a frame changes it. */
  readonly get: () => SceneFrameValues;
  readonly subscribe: (listener: () => void) => () => void;
};

/** What the scene knows about one registered object. It changes when the object's props do, never per frame. */
export type SceneMember = {
  readonly id: string;
  /** The part that registered it, such as `node` or `wire`. Later parts add their own kinds. */
  readonly kind: string;
  /** The readout sentence. An object with a label is an item the reader steps through with the arrow keys. */
  readonly label: string | undefined;
  readonly shape: SceneShape;
  /** The target frame, or undefined for an object placed by others, such as a wire between two nodes. */
  readonly frame: SceneFrame | undefined;
  /** True when the frame only draws: the scene's margins and derived minimum width leave it out. */
  readonly isFloating: boolean;
  /** The room the object needs outside the data box, such as an axis's tick labels. */
  readonly margins: SceneMargins | undefined;
  /** The stacking order: higher draws above, and comes later among the keyboard items that share one place. */
  readonly order: number;
  /** The ids this object attaches to: a wire's ends, a group's members, a callout's target. Each must exist. */
  readonly attaches: ReadonlyArray<string>;
  /** The pixels an object that joins two others keeps between them, such as a wire's room for its text. */
  readonly room: number | undefined;
  /** What the object draws around the objects it attaches to, such as a group's outline and name. */
  readonly surround: SceneMargins | undefined;
  readonly isShown: boolean;
  readonly isActive: boolean;
  /** Why the object's own input cannot be drawn, in a sentence naming it. The scene shows it as invalid. */
  readonly problem: string | undefined;
  readonly track: SceneTrack;
};

/** Every registered object in registration order, and the ids that more than one object claimed. */
export type SceneMembers = { readonly list: ReadonlyArray<SceneMember>; readonly duplicates: ReadonlyArray<string> };

/**
 * The shared record of a scene's objects. Parts register through `useSceneObject`; a part that follows others, such as
 * a wire, looks them up with `member` and subscribes to their `track`.
 */
export type SceneRegistry = {
  readonly members: () => SceneMembers;
  /** Hears every change to the membership: an object added, removed, or given new props. */
  readonly subscribe: (listener: () => void) => () => void;
  readonly member: (id: string) => SceneMember | undefined;
  /** Adds or updates `member` for `owner`. A second owner of the same id is recorded as a duplicate. */
  readonly upsert: (owner: object, member: SceneMember) => void;
  readonly remove: (owner: object, id: string) => void;
  /** Whether the scene has painted once. Objects registered later fade in. */
  readonly isPainted: () => boolean;
  readonly markPainted: () => void;
  /**
   * Records an object during the scene's first render, before any is registered, so `member` finds it for the parts
   * rendered after it. That is how the server draws wires and groups at their target geometry.
   */
  readonly draft: (member: SceneMember) => void;
  /** Whether the scene is still in its first render, so `member` answers from the drafts. */
  readonly isDrafting: () => boolean;
  /** Forgets the drafts once the scene has mounted and its objects are registered. */
  readonly endDrafts: () => void;
};

function isSameList(first: ReadonlyArray<string>, second: ReadonlyArray<string>): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function isSameOffset(first: SceneOffset | undefined, second: SceneOffset | undefined): boolean {
  const [firstAcross = 0, firstDown = 0] = first ?? [];
  const [secondAcross = 0, secondDown = 0] = second ?? [];

  return firstAcross === secondAcross && firstDown === secondDown;
}

function isSameFrame(first: SceneFrame | undefined, second: SceneFrame | undefined): boolean {
  if (first === undefined || second === undefined) {
    return first === second;
  }

  const isSamePlace = first.x === second.x && first.y === second.y && isSameOffset(first.offset, second.offset);

  const isSameSize = first.width === second.width && first.height === second.height;

  return isSamePlace && isSameSize && isSameMargins(first.outset, second.outset);
}

function isSameMargins(first: SceneMargins | undefined, second: SceneMargins | undefined): boolean {
  const isSameEnds = first?.top === second?.top && first?.bottom === second?.bottom;

  return isSameEnds && first?.left === second?.left && first?.right === second?.right;
}

function isSameMember(first: SceneMember, second: SceneMember): boolean {
  const isSameName = first.kind === second.kind && first.label === second.label && first.shape === second.shape;
  const isSameState = first.isShown === second.isShown && first.isActive === second.isActive;
  const isSameLinks = isSameList(first.attaches, second.attaches) && first.track === second.track;
  const isSameShape = first.problem === second.problem && isSameFrame(first.frame, second.frame);
  const isSameOrder = first.isFloating === second.isFloating && first.order === second.order;
  const isSameLayout = isSameOrder && first.room === second.room;

  const isSameIdentity = isSameName && isSameState && isSameLayout;
  const isSameRooms = isSameMargins(first.margins, second.margins) && isSameMargins(first.surround, second.surround);
  const isSamePlace = isSameShape && isSameRooms;

  return isSameIdentity && isSameLinks && isSamePlace;
}

/** Makes an empty registry. `Scene` makes one for itself; a part outside any scene gets a detached one. */
export function createSceneRegistry(): SceneRegistry {
  const entries = new Map<string, { readonly owner: object; readonly member: SceneMember }>();
  const extra = new Map<string, Set<object>>();
  const drafts = new Map<string, SceneMember>();
  const listeners = new Set<() => void>();

  const state: { snapshot: SceneMembers | undefined; isPainted: boolean; isDrafting: boolean } = {
    snapshot: undefined,
    isPainted: false,
    isDrafting: true,
  };

  function changed(): void {
    state.snapshot = undefined;

    for (const listener of listeners) {
      listener();
    }
  }

  function members(): SceneMembers {
    state.snapshot ??= { list: Array.from(entries.values(), (entry) => entry.member), duplicates: [...extra.keys()] };

    return state.snapshot;
  }

  function upsert(owner: object, member: SceneMember): void {
    const held = entries.get(member.id);

    if (held !== undefined && held.owner !== owner) {
      const owners = extra.get(member.id) ?? new Set<object>();
      const isUnknownOwner = !owners.has(owner);

      owners.add(owner);
      extra.set(member.id, owners);

      if (isUnknownOwner) {
        changed();
      }

      return;
    }

    if (held !== undefined && isSameMember(held.member, member)) {
      return;
    }

    entries.set(member.id, { owner, member });
    changed();
  }

  function remove(owner: object, id: string): void {
    const owners = extra.get(id);

    if (owners?.delete(owner) === true) {
      if (owners.size === 0) {
        extra.delete(id);
      }

      changed();

      return;
    }

    if (entries.get(id)?.owner === owner) {
      entries.delete(id);
      changed();
    }
  }

  return {
    members,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    member: (id) => entries.get(id)?.member ?? (state.isDrafting ? drafts.get(id) : undefined),
    upsert,
    remove,
    isPainted: () => state.isPainted,
    markPainted: () => {
      state.isPainted = true;
    },
    draft: (member) => {
      drafts.set(member.id, member);
    },
    isDrafting: () => state.isDrafting,
    endDrafts: () => {
      if (!state.isDrafting) {
        return;
      }

      state.isDrafting = false;

      drafts.clear();
      changed();
    },
  };
}

/**
 * Makes a store that each scene keeps for one kind of part, such as the stacks cards read their places from. The
 * returned function gives a scene's store, made on first use and kept while the scene's registry lives.
 */
export function sceneStore<Store extends object>(create: () => Store): (registry: SceneRegistry) => Store {
  const stores = new WeakMap<SceneRegistry, Store>();

  return (registry) => {
    const held = stores.get(registry);

    if (held !== undefined) {
      return held;
    }

    const made = create();

    stores.set(registry, made);

    return made;
  };
}
