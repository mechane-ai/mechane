import * as stylex from '@stylexjs/stylex';
import { useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useSceneFrames, useSceneObject } from './scene-context.ts';
import type { SceneContextValue } from './scene-context.ts';
import { edgePoint, rectCenter, segmentInside, sharedArea } from './scene-geometry.ts';
import type { ScenePixel, SceneRect } from './scene-geometry.ts';
import { SceneLayer, SceneOutside } from './scene-layer.tsx';
import { useClaimedBox, useObstacleLines, useTakenBoxes } from './scene-obstacles.ts';

/**
 * The side a callout prefers. `auto` prefers right, then left, below and above. A callout leaves its preferred side
 * when that side would cover another object.
 */
export type SceneCalloutSide = 'auto' | 'top' | 'right' | 'bottom' | 'left';

export type SceneCalloutProps = {
  /** The id of the object the callout explains. */
  readonly to: string;
  /** Defaults to `callout:` and the target id. */
  readonly id?: string | undefined;
  /** The side the callout prefers. Defaults to `auto`. */
  readonly side?: SceneCalloutSide | undefined;
  /** The callout's widest width in pixels. Defaults to 176; the prose wraps inside it, and it narrows to find room. */
  readonly width?: number | undefined;
  /** False fades the callout and its leader out. Defaults to true. */
  readonly isShown?: boolean | undefined;
  /** The prose. */
  readonly children: ReactNode;
};

type PlacedSide = Exclude<SceneCalloutSide, 'auto'>;

/** Where along its side a candidate box sits: centered on the object, or flush with its start or end edge. */
type Alignment = 'center' | 'start' | 'end';

type Candidate = { readonly rect: SceneRect; readonly cost: number };

const GAP = 18;
const EDGE = 4;
const HEIGHT_GUESS = 40;
const sidesInOrder: ReadonlyArray<PlacedSide> = ['right', 'left', 'bottom', 'top'];
const alignments: ReadonlyArray<Alignment> = ['center', 'start', 'end'];
/** The widths a callout may narrow to when its full width covers other objects, as fractions of it. */
const narrowings: ReadonlyArray<number> = [1, 0.8, 0.64];
/** Covering an object or a label costs this much per square pixel, so any free spot wins over any covering one. */
const COVER_COST = 1000;
const SIDE_COST = 40;
const ALIGN_COST = 10;
/** Each pixel of wire or curve under a callout costs this much, so a short detour off its side wins. */
const LINE_COST = 4;
const NARROW_COST = 60;

const styles = stylex.create({
  callout: (transform: string, width: number) => ({
    position: 'absolute',
    left: 0,
    top: 0,
    width,
    transform,
    boxSizing: 'border-box',
    paddingBlock: spacing.xs,
    paddingInline: spacing.sm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
    pointerEvents: 'auto',
  }),
  fade: (opacity: number) => ({ opacity }),
  gone: { visibility: 'hidden' },
  leader: (opacity: number) => ({
    stroke: colors.muted,
    strokeWidth: 1,
    fill: 'none',
    opacity,
    vectorEffect: 'non-scaling-stroke',
    pointerEvents: 'none',
  }),
  end: (opacity: number) => ({ fill: colors.muted, opacity, pointerEvents: 'none' }),
});

function boxOn({
  side,
  alignment,
  target,
  size,
  stage,
}: {
  readonly side: PlacedSide;
  readonly alignment: Alignment;
  readonly target: SceneRect;
  readonly size: { readonly width: number; readonly height: number };
  readonly stage: { readonly width: number; readonly height: number };
}): SceneRect {
  const center = rectCenter(target);
  const { width, height } = size;

  const lefts: Readonly<Record<Alignment, number>> = {
    center: center.x - width / 2,
    start: target.left,
    end: target.right - width,
  };

  const tops: Readonly<Record<Alignment, number>> = {
    center: center.y - height / 2,
    start: target.top,
    end: target.bottom - height,
  };

  const across = Math.min(stage.width - width - EDGE, Math.max(EDGE, lefts[alignment]));
  const down = Math.min(stage.height - height - EDGE, Math.max(EDGE, tops[alignment]));

  const corners: Readonly<Record<PlacedSide, ScenePixel>> = {
    right: { x: target.right + GAP, y: down },
    left: { x: target.left - GAP - width, y: down },
    bottom: { x: across, y: target.bottom + GAP },
    top: { x: across, y: target.top - GAP - height },
  };

  const corner = corners[side];

  return { left: corner.x, top: corner.y, right: corner.x + width, bottom: corner.y + height };
}

function isInside(rect: SceneRect, stage: { readonly width: number; readonly height: number }): boolean {
  const isInsideX = rect.left >= EDGE - 1 && rect.right <= stage.width - EDGE + 1;

  return isInsideX && rect.top >= EDGE - 1 && rect.bottom <= stage.height - EDGE + 1;
}

/** What a callout keeps clear of: the boxes of other objects and placed text, and the lines of wires and curves. */
type Avoided = { readonly boxes: ReadonlyArray<SceneRect>; readonly lines: ReadonlyArray<ReadonlyArray<ScenePixel>> };

/**
 * The boxes and wire lines of the shown objects besides the target. An object whose box holds the target, such as the
 * stack around a card, is left out, since a callout can only sit beside the target inside it.
 */
function avoidedBy(scene: SceneContextValue, target: SceneRect, to: string): Avoided {
  const center = rectCenter(target);
  const shown = scene.registry.members().list.filter((member) => member.isShown && member.id !== to);

  function centerOf(id: string): ScenePixel | undefined {
    const member = scene.registry.member(id);

    return member?.frame === undefined ? undefined : rectCenter(scene.rectOf(member.track.get()));
  }

  return {
    boxes: shown.flatMap((member) => {
      const rect = member.frame === undefined ? undefined : scene.rectOf(member.track.get());

      if (rect === undefined) {
        return [];
      }

      const isAcross = rect.left <= center.x && rect.right >= center.x;

      return isAcross && rect.top <= center.y && rect.bottom >= center.y ? [] : [rect];
    }),
    lines: shown.flatMap((member) => {
      const ends = member.kind === 'wire' ? member.attaches.map(centerOf) : [];
      const [from, end] = ends;

      return from === undefined || end === undefined ? [] : [[from, end]];
    }),
  };
}

/** How long the stretch of `lines` inside `rect` is, in pixels. */
function lineInside(rect: SceneRect, lines: ReadonlyArray<ReadonlyArray<ScenePixel>>): number {
  return lines
    .flatMap((line) => line.slice(1).map((to, index) => segmentInside({ rect, from: line[index] ?? to, to })))
    .reduce((total, length) => total + length, 0);
}

/** The area of `boxes` that `rect` covers, in square pixels. */
function boxesCovered(rect: SceneRect, boxes: ReadonlyArray<SceneRect>): number {
  return boxes.map((box) => sharedArea(rect, box)).reduce((total, area) => total + area, 0);
}

/** The point on a box's edge nearest a target point, where a leader line leaves it. */
function nearestOnRect(rect: SceneRect, point: ScenePixel): ScenePixel {
  return {
    x: Math.min(rect.right, Math.max(rect.left, point.x)),
    y: Math.min(rect.bottom, Math.max(rect.top, point.y)),
  };
}

type Placement = {
  readonly scene: SceneContextValue;
  readonly to: string;
  readonly target: SceneRect;
  readonly side: SceneCalloutSide;
  readonly width: number;
  /** The callout's last measured box, from which the height at a narrower width is estimated. */
  readonly measured: { readonly width: number; readonly height: number };
  readonly avoided: Avoided;
};

/**
 * The callout's box: on a side of the target, inside the stage, and over as little as it can. Covering another object
 * or placed text costs most, then the length of wires and curves under it, then leaving the preferred side or width.
 */
function placeCallout({ scene, to, target, side, width, measured, avoided }: Placement): SceneRect {
  const stage = { width: scene.box.width, height: scene.box.height };
  const sides = side === 'auto' ? sidesInOrder : [side, ...sidesInOrder.filter((other) => other !== side)];
  const area = measured.width * measured.height;
  const objects = avoidedBy(scene, target, to);
  const boxes = [...objects.boxes, ...avoided.boxes];
  const lines = [...objects.lines, ...avoided.lines];

  const candidates: ReadonlyArray<Candidate> = narrowings.flatMap((narrowing, narrowed) => {
    const size = { width: Math.round(width * narrowing), height: Math.ceil(area / Math.round(width * narrowing)) };

    return sides.flatMap((placed, sideIndex) =>
      alignments.flatMap((alignment, alignIndex) => {
        const rect = boxOn({ side: placed, alignment, target, size, stage });
        const preference = sideIndex * SIDE_COST + alignIndex * ALIGN_COST + narrowed * NARROW_COST;
        const cost = boxesCovered(rect, boxes) * COVER_COST + lineInside(rect, lines) * LINE_COST + preference;

        return isInside(rect, stage) ? [{ rect, cost }] : [];
      }),
    );
  });

  const cheapest = candidates.toSorted((first, second) => first.cost - second.cost)[0];
  const fallback = boxOn({ side: sides[0] ?? 'right', alignment: 'center', target, size: measured, stage });

  return cheapest?.rect ?? fallback;
}

/**
 * Prose attached to a scene object by a leader line: "the weighted sum", "this weight just flipped sign". It sits
 * beside its object and inside the frame, keeping off other objects, labels, wires and curves, narrowing when it must.
 * It follows the object as it moves.
 */
export function SceneCallout({
  to,
  id = `callout:${to}`,
  side = 'auto',
  width = 176,
  isShown = true,
  children,
}: SceneCalloutProps): ReactNode {
  const [target] = useSceneFrames([to]);
  const object = useSceneObject({ id, kind: 'callout', values: {}, attaches: [to], isShown });
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState({ width, height: HEIGHT_GUESS });
  const avoided = { boxes: useTakenBoxes(id), lines: useObstacleLines(to) };
  const { scene } = object;
  const targetRect = target?.rect;

  const chosen =
    targetRect === undefined || !scene.isInScene
      ? undefined
      : placeCallout({ scene, to, target: targetRect, side, width, measured, avoided });

  useClaimedBox(id, isShown && chosen !== undefined ? chosen : null);

  useLayoutEffect(() => {
    if (element === null) {
      return;
    }

    const observer = new ResizeObserver(() =>
      setMeasured((known) => {
        const isSame = known.width === element.offsetWidth && known.height === element.offsetHeight;

        return isSame ? known : { width: element.offsetWidth, height: element.offsetHeight };
      }),
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  if (!scene.isInScene) {
    return <SceneOutside part="SceneCallout" />;
  }

  if (target === undefined || targetRect === undefined || chosen === undefined) {
    return null;
  }

  const opacity = object.values.opacity * target.values.opacity;
  const start = nearestOnRect(chosen, rectCenter(targetRect));
  const end = edgePoint({ rect: targetRect, shape: target.member.shape, toward: start });

  return (
    <>
      <SceneLayer layer="front">
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} {...stylex.props(styles.leader(opacity))} />
        <circle cx={end.x} cy={end.y} r={2} {...stylex.props(styles.end(opacity))} />
      </SceneLayer>
      <div
        ref={setElement}
        aria-hidden={isShown ? undefined : true}
        {...stylex.props(
          styles.callout(`translate(${chosen.left}px, ${chosen.top}px)`, chosen.right - chosen.left),
          styles.fade(opacity),
          !object.isVisible && styles.gone,
        )}
      >
        {children}
      </div>
    </>
  );
}
