import { createContext, use, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ChartTone, NumericDomain } from '../../../charts/src/index.ts';
import { automaticTone, continuousScale, plotBox } from '../../../charts/src/plot/index.ts';
import type { ContinuousScale, MarkEmphasis, PlotBox, ToneInput } from '../../../charts/src/plot/index.ts';
import { isMotionReduced, onFrame } from '../time/clock.ts';
import { createTween } from '../time/tween.ts';
import type { Pace } from '../time/tween.ts';
import { useTween } from '../time/use-tween.ts';
import type { SceneFrame, SceneMargins, SceneRect, SceneShape, SceneView } from './scene-geometry.ts';
import { createSceneRegistry } from './scene-registry.ts';
import type { SceneFrameKey, SceneFrameValues, SceneMember, SceneRegistry } from './scene-registry.ts';
import { delayOf, staggersOf } from './scene-stagger.ts';
import type { SceneDelay, SceneStaggerPlace } from './scene-stagger.ts';
import { sceneLabels } from './scene-validate.ts';
import type { SceneLabels } from './scene-validate.ts';

const HALF = 0.5;

/** How strongly an object draws for each emphasis: a receded one dims while another is inspected or active. */
const strengths: Readonly<Record<MarkEmphasis, number>> = { normal: 1, context: 1, receded: 0.32 };

/** The camera's animated view of the data box. */
export type SceneCamera = { readonly get: () => SceneView; readonly subscribe: (listener: () => void) => () => void };

/** The SVG groups under the HTML layer that SVG parts draw into, back to front. Null until the scene mounts. */
export type SceneLayerElements = {
  readonly back: SVGGElement | null;
  readonly wires: SVGGElement | null;
  readonly front: SVGGElement | null;
};

/** What a scene shares with its parts that changes only with its props or its width, never per frame. */
export type SceneSetup = {
  /** False for a part rendered outside any `Scene`. Such a part shows an inline error instead of drawing. */
  readonly isInScene: boolean;
  readonly registry: SceneRegistry;
  readonly camera: SceneCamera;
  /** The drawing area in the plot's CSS pixels. A node centered on the data box's edge stays whole inside the plot. */
  readonly box: PlotBox;
  /** The whole data box the scene declares. */
  readonly domain: { readonly x: NumericDomain; readonly y: NumericDomain };
  readonly pace: Pace;
  readonly locale: string;
  /** Resolves a record's tone: its own, then the enclosing tone scope's, then its place. */
  readonly tone: (input: ToneInput) => ChartTone;
  /** The weight magnitude that draws the thickest wire. */
  readonly weightMax: number;
  readonly layers: SceneLayerElements;
  /** The scene's words, so parts write their errors in the author's language. */
  readonly labels: SceneLabels;
  /** The camera's scales for a view, computed once per frame and shared by every part. */
  readonly scalesFor: (view: SceneView) => SceneScales;
};

/** The camera's scales for one view, with the pixel rectangle of an animated frame under them. */
export type SceneScales = {
  readonly x: ContinuousScale;
  readonly y: ContinuousScale;
  readonly rectOf: (values: SceneFrameValues) => SceneRect;
};

/** The inspection state the scene's `Chart` holds, shared with every part. It changes only on inspection. */
export type SceneMarks = {
  readonly inspected: string | null;
  readonly selected: string | null;
  readonly cursor: string | null;
  /** The ids drawn at full strength while something is inspected or active, or null when nothing recedes. */
  readonly lit: ReadonlySet<string> | null;
  /** Whether the plot has keyboard focus, so the keyboard cursor is drawn. */
  readonly isKeyboardFocused: boolean;
  /** Moves focus to the plot, so the arrow keys carry on from a pressed object. */
  readonly focusPlot: () => void;
};

/** The scene as a part sees it in this frame: the setup, plus the camera's current scales. */
export type SceneContextValue = SceneSetup & {
  /** Maps data x to plot pixels through the camera. A position outside the view lands outside the box. */
  readonly x: ContinuousScale;
  /** Maps data y to plot pixels through the camera. y grows upward, as on a chart. */
  readonly y: ContinuousScale;
  readonly view: SceneView;
  /** An object's pixel rectangle from its animated frame values. */
  readonly rectOf: (values: SceneFrameValues) => SceneRect;
};

function detachedSetup(): SceneSetup {
  const placement = {
    box: plotBox({ width: 1, height: 1, margins: { top: 0, right: 0, bottom: 0, left: 0 } }),
    domain: { x: [0, 1], y: [0, 1] },
  } as const;

  return {
    ...placement,
    scalesFor: cachedScales(placement),
    isInScene: false,
    registry: createSceneRegistry(),
    camera: createTween({ x0: 0, x1: 1, y0: 0, y1: 1 }),
    pace: 'regular',
    locale: 'en-US',
    tone: ({ tone, index }) => tone ?? automaticTone(index),
    weightMax: 1,
    layers: { back: null, wires: null, front: null },
    labels: sceneLabels,
  };
}

/** The scene's setup. `Scene` provides it; the default is a detached scene, so a part outside one never throws. */
export const SceneSetupContext = createContext<SceneSetup>(detachedSetup());

function ignoreFocus(): void {
  // Outside a scene there is no plot to focus.
}

/** The scene's inspection state. `Scene` provides it from its `Chart`. */
export const SceneMarksContext = createContext<SceneMarks>({
  inspected: null,
  selected: null,
  cursor: null,
  lit: null,
  isKeyboardFocused: false,
  focusPlot: ignoreFocus,
});

type CameraScaleInput = {
  readonly domain: NumericDomain;
  readonly low: number;
  readonly high: number;
  readonly range: readonly [number, number];
};

/** The kernel's scale over the whole box, viewed through the camera. Unlike the kernel's, it extends past the view. */
function cameraScale({ domain, low, high, range }: CameraScaleInput): ContinuousScale {
  const whole = continuousScale({ domain, range: [0, 1] });
  const span = domain[1] - domain[0];

  function fraction(value: number): number {
    const isInside = value >= domain[0] && value <= domain[1];

    return isInside ? whole.position(value) : (value - domain[0]) / span;
  }

  const start = fraction(low);
  const shown = fraction(high) - start;
  const length = range[1] - range[0];

  return {
    type: 'linear',
    domain: [low, high],
    range,
    position: (value) => range[0] + ((fraction(value) - start) / shown) * length,
    valueAt: (position) => domain[0] + (start + ((position - range[0]) / length) * shown) * span,
  };
}

/** The pixel rectangle of an animated frame under two scales. */
export function frameRect({
  values,
  x,
  y,
}: {
  readonly values: SceneFrameValues;
  readonly x: ContinuousScale;
  readonly y: ContinuousScale;
}): SceneRect {
  const centerX = x.position(values.x) + values.dx;
  const centerY = y.position(values.y) + values.dy;
  const halfWidth = values.width * HALF;
  const halfHeight = values.height * HALF;

  return {
    left: centerX - halfWidth,
    top: centerY - halfHeight,
    right: centerX + halfWidth,
    bottom: centerY + halfHeight,
  };
}

/** The camera's scales for a view of the scene's box. */
function sceneScales(setup: Pick<SceneSetup, 'box' | 'domain'>, view: SceneView): SceneScales {
  const { box, domain } = setup;
  const across = cameraScale({ domain: domain.x, low: view.x0, high: view.x1, range: [box.left, box.right] });
  const up = cameraScale({ domain: domain.y, low: view.y0, high: view.y1, range: [box.bottom, box.top] });

  return { x: across, y: up, rectOf: (values) => frameRect({ values, x: across, y: up }) };
}

/** `sceneScales` for one box, remembering the last view, so the parts drawn in a frame share one set of scales. */
export function cachedScales(setup: Pick<SceneSetup, 'box' | 'domain'>): (view: SceneView) => SceneScales {
  const cache: { view: SceneView | undefined; scales: SceneScales } = {
    view: undefined,
    scales: sceneScales(setup, {
      x0: setup.domain.x[0],
      x1: setup.domain.x[1],
      y0: setup.domain.y[0],
      y1: setup.domain.y[1],
    }),
  };

  return (view) => {
    if (cache.view !== view) {
      cache.view = view;
      cache.scales = sceneScales(setup, view);
    }

    return cache.scales;
  };
}

/**
 * The scene a part is drawn in, with the camera's scales for this frame. A part that calls it redraws while the camera
 * moves. Outside a scene `isInScene` is false and the part should show an inline error.
 */
export function useSceneContext(): SceneContextValue {
  const setup = use(SceneSetupContext);
  const view = useSyncExternalStore(setup.camera.subscribe, setup.camera.get, setup.camera.get);

  return { ...setup, ...setup.scalesFor(view), view };
}

/** What a part tells the scene about one of its objects. Every field but `id`, `kind` and `values` is optional. */
export type SceneObjectInput<Key extends string> = {
  /** Stable across renders. A change of any other field eases the object to the new state. */
  readonly id: string;
  /** The part's name for its objects, such as `node` or `card`. */
  readonly kind: string;
  /**
   * The target center in data units, pixel shift and pixel size. Leave it out for objects placed by others, such as
   * wires.
   */
  readonly frame?: SceneFrame | undefined;
  /**
   * True when the frame only draws, so the scene makes no room for it: a point on a curve, or a card its stack makes
   * room for. Left false, the margins keep the frame whole and the derived minimum width keeps it off its neighbours.
   */
  readonly isFloating?: boolean | undefined;
  /** The room the object needs outside the data box, per side in pixels, such as an axis's tick labels. */
  readonly margins?: SceneMargins | undefined;
  /** The stacking order, 0 by default. Higher draws above and comes later among keyboard items that share a place. */
  readonly order?: number | undefined;
  /** How long every change waits before it starts. Defaults to 0. */
  readonly delay?: SceneDelay | undefined;
  /** The object's place in a stagger group: changes in one update start one step apart, a lone change at once. */
  readonly stagger?: SceneStaggerPlace | undefined;
  /** More numbers to ease with the frame, such as a card's `turn`. Pass `{}` when there are none. */
  readonly values: Readonly<Record<Key, number>>;
  /** The outline wires attach to. Defaults to `box`. */
  readonly shape?: SceneShape | undefined;
  /** The readout sentence. With one, the object is an item the arrow keys step through. */
  readonly label?: string | undefined;
  /** The ids the object attaches to. The scene reports one that does not exist. */
  readonly attaches?: ReadonlyArray<string> | undefined;
  /** The pixels an object that joins two others keeps between them, such as a wire's room for its arrow and text. */
  readonly room?: number | undefined;
  /**
   * What the object draws around the objects it attaches to, in pixels per side, such as a group's outline and name.
   * The scene keeps it inside the margins.
   */
  readonly surround?: SceneMargins | undefined;
  /** False fades the object out and takes it out of the keyboard order. Defaults to true. */
  readonly isShown?: boolean | undefined;
  /** True keeps the object at full strength while others recede, like an inspected one. */
  readonly isActive?: boolean | undefined;
  /** The emphasis the author chose. `context` always draws gray; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** Why this object's own input cannot be drawn, naming its id. The scene shows it as invalid. */
  readonly problem?: string | undefined;
  /** Overrides the scene's pace for this object. */
  readonly pace?: Pace | undefined;
};

/** One object as a part draws it in this frame. */
export type SceneObjectState<Key extends string> = {
  /** The eased values on screen now: the frame keys, `opacity`, and the part's own `values`. */
  readonly values: Readonly<Record<Key | SceneFrameKey, number>>;
  /** The pixel rectangle now, or undefined for an object without a frame. */
  readonly rect: SceneRect | undefined;
  /** False once a hidden object has faded out completely. Draw nothing, or keep it invisible to save its state. */
  readonly isVisible: boolean;
  readonly isInspected: boolean;
  readonly isSelected: boolean;
  /** Whether the keyboard cursor rests here while the plot has keyboard focus. */
  readonly isCursor: boolean;
  /** The emphasis to draw with, from the author's choice, inspection and active objects. */
  readonly emphasis: MarkEmphasis;
  /**
   * How strongly to draw now: 1 at full strength, less while the object recedes. It eases on the shared clock; multiply
   * it into the opacity of a part drawn in HTML.
   */
  readonly strength: number;
  /** Moves focus to the scene's plot, so the arrow keys carry on from a pressed object. */
  readonly focusPlot: () => void;
  readonly scene: SceneContextValue;
};

function resolvedEmphasis({
  id,
  marks,
  emphasis,
}: {
  readonly id: string;
  readonly marks: SceneMarks;
  readonly emphasis: MarkEmphasis | undefined;
}): MarkEmphasis {
  if (emphasis === 'context') {
    return 'context';
  }

  if (marks.inspected === id) {
    return 'normal';
  }

  if (marks.lit !== null) {
    return marks.lit.has(id) ? 'normal' : 'receded';
  }

  return emphasis ?? 'normal';
}

/**
 * Registers an object with the nearest scene and returns its animated state. The first render shows the target with no
 * motion; a later change eases there on the shared clock, and an object first rendered after the scene's first paint
 * fades in. Only the calling part redraws while its object moves.
 */
export function useSceneObject<Key extends string>(input: SceneObjectInput<Key>): SceneObjectState<Key> {
  const scene = useSceneContext();
  const marks = use(SceneMarksContext);
  const { registry } = scene;
  const { id, kind, frame, values, shape = 'box', label, attaches = [], isShown = true, isActive = false } = input;
  const { emphasis, problem, pace = scene.pace, isFloating = false, margins, order = 0, delay = 0, stagger } = input;
  const { room, surround } = input;
  const [owner] = useState(() => ({}));

  const target = {
    ...values,
    x: frame?.x ?? 0,
    y: frame?.y ?? 0,
    dx: frame?.offset?.[0] ?? 0,
    dy: frame?.offset?.[1] ?? 0,
    width: frame?.width ?? 0,
    height: frame?.height ?? 0,
    opacity: isShown ? 1 : 0,
  };

  const [tween] = useState(() =>
    createTween<Key | SceneFrameKey>({ ...target, opacity: registry.isPainted() ? 0 : target.opacity }),
  );

  const [waiting] = useState(() => ({ key: JSON.stringify(tween.get()), stop: (): void => undefined }));
  const shown = useSyncExternalStore(tween.subscribe, tween.get, tween.get);
  const resolved = resolvedEmphasis({ id, marks, emphasis });
  const { strength } = useTween({ strength: strengths[resolved] }, 'fast');

  const member = {
    id,
    kind,
    label,
    shape,
    frame,
    isFloating,
    margins,
    order,
    attaches,
    room,
    surround,
    isShown,
    isActive,
    problem,
  };

  if (registry.isDrafting()) {
    registry.draft({ ...member, track: tween });
  }

  useLayoutEffect(() => {
    const key = JSON.stringify(target);

    registry.upsert(owner, { ...member, track: tween });

    if (pace === 'instant' || isMotionReduced()) {
      waiting.stop();

      waiting.key = key;

      tween.to(target, pace);

      return;
    }

    if (waiting.key === key) {
      return;
    }

    waiting.key = key;

    waiting.stop();

    function begin(staggered: number): void {
      const wait = delayOf(delay) + staggered;

      if (wait <= 0) {
        tween.to(target, pace);

        return;
      }

      const clock: { start: number | undefined } = { start: undefined };

      waiting.stop = onFrame((now) => {
        clock.start ??= now;

        if (now - clock.start >= wait) {
          waiting.stop();
          tween.to(target, pace);
        }
      });
    }

    if (stagger === undefined) {
      begin(0);
    } else {
      waiting.stop = staggersOf(registry).join({ place: stagger, begin });
    }
  });

  useLayoutEffect(() => () => registry.remove(owner, id), [registry, owner, id]);

  useLayoutEffect(
    () => () => {
      waiting.stop();
      tween.destroy();
    },
    [tween, waiting],
  );

  return {
    values: shown,
    rect: frame === undefined ? undefined : scene.rectOf(shown),
    isVisible: isShown || shown.opacity > 0,
    isInspected: marks.inspected === id,
    isSelected: marks.selected === id,
    isCursor: marks.isKeyboardFocused && marks.cursor === id,
    emphasis: resolved,
    strength,
    focusPlot: marks.focusPlot,
    scene,
  };
}

/** Another object as a follower sees it in this frame, such as a node a wire attaches to. */
export type SceneFollowed = {
  readonly member: SceneMember;
  readonly values: SceneFrameValues;
  /** The pixel rectangle now, or undefined for an object without a frame. */
  readonly rect: SceneRect | undefined;
};

function useTuple<Value>(
  subscribe: (listener: () => void) => () => void,
  read: () => ReadonlyArray<Value>,
): ReadonlyArray<Value> {
  const cache = useRef<ReadonlyArray<Value>>([]);

  function snapshot(): ReadonlyArray<Value> {
    const next = read();
    const previous = cache.current;
    const isSame = next.length === previous.length && next.every((value, index) => value === previous[index]);

    if (!isSame) {
      cache.current = next;
    }

    return cache.current;
  }

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Follows other objects by id: their members and animated geometry, redrawn on each frame any of them moves. Use it in
 * a part that attaches to others, as wires, groups and callouts do. An id with no object yields undefined.
 */
export function useSceneFrames(ids: ReadonlyArray<string>): ReadonlyArray<SceneFollowed | undefined> {
  const scene = useSceneContext();
  const { registry } = scene;
  const members = useTuple(registry.subscribe, () => ids.map((id) => registry.member(id)));

  const subscribe = useMemo(
    () => (listener: () => void) => {
      const stops = members.flatMap((member) => (member === undefined ? [] : [member.track.subscribe(listener)]));

      return () => {
        for (const stop of stops) {
          stop();
        }
      };
    },
    [members],
  );

  const tracked = useTuple(subscribe, () => members.map((member) => member?.track.get()));

  return members.map((member, index) => {
    const values = tracked[index];

    return member === undefined || values === undefined
      ? undefined
      : { member, values, rect: member.frame === undefined ? undefined : scene.rectOf(values) };
  });
}
