import * as stylex from '@stylexjs/stylex';
import { bindDrag, dragThreshold } from '@ui-sdk/core';
import { clamp, scrubTo } from '@ui-sdk/core/number';
import { use, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { useScopedTone } from '../../../../charts/src/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { ChartMark, DotMark } from '../../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import type { NumberParam } from '../../lesson/define-lesson.ts';
import { LessonContext } from '../../lesson/lesson-context.ts';
import type { LessonScope } from '../../lesson/lesson-context.ts';
import type { Pace } from '../../time/tween.ts';
import { SceneMarksContext, useSceneContext, useSceneObject } from '../scene-context.ts';
import type { SceneContextValue } from '../scene-context.ts';
import { rectCenter } from '../scene-geometry.ts';
import type { ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { useObstacle } from '../scene-obstacles.ts';
import { sceneOutlines } from '../scene-style.ts';
import { fillLabel } from '../scene-validate.ts';
import { PlaneMarks } from './plane-hit.tsx';
import { PlaneLabel, spotsAround } from './plane-label.tsx';
import { planeLabels } from './plane-labels.ts';
import type { ScenePlaneLabels } from './plane-labels.ts';

/** Why a point moved: a pointer drag, or an arrow key. A cancelled drag reports `drag` with the starting position. */
export type ScenePointMoveDetails = {
  readonly reason: 'drag' | 'step-key';
  readonly event: PointerEvent | KeyboardEvent;
};

/** What a movable point keeps fixed: `x` moves it along x only, `y` along y only, a function along that curve. */
export type ScenePointAlong = 'x' | 'y' | ((across: number) => number);

/** The number params of the nearest `Lesson` a moved point writes: its x position to one, its y position to another. */
export type ScenePointSets = { readonly x?: string | undefined; readonly y?: string | undefined };

export type ScenePointProps = {
  /** Stable across states: the point with this id eases to its new position. */
  readonly id: string;
  /** The point's position, in the scene's data units. Wires, callouts and projections attach to it. */
  readonly at: ScenePosition;
  /** The readout sentence. With one, the arrow keys reach the point. Required when the point can move. */
  readonly label?: string | undefined;
  /** Short text beside the point, placed where it touches no curve. */
  readonly text?: string | undefined;
  /** The hue that names the point. Left out, the tone scope's tone for the id, or the first series hue. */
  readonly tone?: ChartTone | undefined;
  /** `context` draws the point gray; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** False fades the point out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  /** True keeps the point and what attaches to it at full strength while the rest recede. */
  readonly isActive?: boolean | undefined;
  /**
   * Makes the point movable by a pointer and by the arrow keys when it is the keyboard cursor. It is told where the
   * reader wants the point; the point stays where `at` says until the application moves it.
   */
  readonly onMove?: ((position: ScenePosition, details: ScenePointMoveDetails) => void) | undefined;
  /**
   * Makes the point movable and names the lesson number params its position writes, as `{ x: 'weight' }`. A move sets
   * them in one change, on each param's step grid and inside its range; `at` stays the author's, read from the lesson.
   */
  readonly sets?: ScenePointSets | undefined;
  /** The step, in data units, that a moved point lands on along each axis it moves. A bound axis takes its param's. */
  readonly snap?: number | undefined;
  /** Limits the movement. Left out, a point bound on one axis moves along it, and any other moves freely in the box. */
  readonly along?: ScenePointAlong | undefined;
  /** Overrides the scene's pace for this point. A drag always follows the pointer at once. */
  readonly pace?: Pace | undefined;
  readonly labels?: Partial<ScenePlaneLabels> | undefined;
};

const POINT_RADIUS = 6;
const HIT_SIZE = 28;
const HIT_HALF = 14;
const KEY_STEPS = 100;
const LARGE_STEP = 10;
const PLOT = '[role="group"][tabindex]';

const keyDirections: Readonly<Record<string, readonly [number, number] | undefined>> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

const styles = stylex.create({
  target: (transform: string) => ({
    position: 'absolute',
    left: 0,
    top: 0,
    width: HIT_SIZE,
    height: HIT_SIZE,
    transform,
    pointerEvents: 'auto',
  }),
  movable: { cursor: 'grab', touchAction: 'none' },
  dragging: { cursor: 'grabbing' },
  mark: { position: 'absolute', inset: 0, borderRadius: '50%', outlineStyle: 'none' },
});

/** How one axis of a moved point lands: inside its domain, and on its step grid when it has one. */
type AxisGrid = { readonly min: number; readonly max: number; readonly step: number | undefined };

type Constraint = {
  readonly at: ScenePosition;
  readonly grids: { readonly x: AxisGrid; readonly y: AxisGrid };
  readonly along: ScenePointAlong | undefined;
};

function landed(value: number, { min, max, step }: AxisGrid): number {
  return step === undefined ? clamp(value, min, max) : scrubTo(clamp(value, min, max), { min, max, step }).value;
}

/** A bound axis lands on its param's range and step; any other on the box, on `snap` when it is given. */
function gridOf(domain: readonly [number, number], snap: number | undefined, param: NumberParam | undefined): AxisGrid {
  return param === undefined
    ? { min: domain[0], max: domain[1], step: snap }
    : { min: param.min, max: param.max, step: param.step };
}

/** The bound params of the nearest lesson, or the sentence naming why the binding cannot be used. */
function boundParams({
  id,
  sets,
  scope,
  labels,
}: {
  readonly id: string;
  readonly sets: ScenePointSets;
  readonly scope: LessonScope | null;
  readonly labels: ScenePlaneLabels;
}): { readonly x?: NumberParam; readonly y?: NumberParam } | string {
  if (scope === null) {
    return fillLabel(labels.pointOutsideLesson, { id });
  }

  const entries = (['x', 'y'] as const).flatMap((axis) => {
    const name = sets[axis];
    const param = name === undefined ? undefined : scope.lesson.params[name];

    return name === undefined ? [] : [{ axis, name, param: param?.kind === 'number' ? param : undefined }];
  });

  const unknown = entries.find((entry) => entry.param === undefined);

  if (unknown !== undefined) {
    return fillLabel(labels.pointParam, { id, name: unknown.name, lesson: scope.lesson.id });
  }

  return Object.fromEntries(entries.map((entry) => [entry.axis, entry.param]));
}

/** Where a requested position ends up: on the step grid, inside the box, and on the line the point is kept to. */
function constrain(raw: ScenePosition, { at, grids, along }: Constraint): ScenePosition {
  const across = along === 'y' ? at[0] : landed(raw[0], grids.x);

  if (typeof along === 'function') {
    const up = along(across);

    return [across, Number.isFinite(up) ? clamp(up, grids.y.min, grids.y.max) : at[1]];
  }

  return [across, along === 'x' ? at[1] : landed(raw[1], grids.y)];
}

/** The position an arrow key asks for, or undefined when the key is not one this point uses. */
function keyMove(event: KeyboardEvent, constraint: Constraint): ScenePosition | undefined {
  const direction = keyDirections[event.key];
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
  const { at, grids, along } = constraint;

  if (direction === undefined || hasModifier) {
    return undefined;
  }

  const isAcross = direction[0] !== 0;
  const isLockedY = along === 'x' && !isAcross;
  const isLockedX = along === 'y' && isAcross;

  if (isLockedY || isLockedX) {
    return undefined;
  }

  const size = event.shiftKey ? LARGE_STEP : 1;
  const stepX = (grids.x.step ?? (grids.x.max - grids.x.min) / KEY_STEPS) * size;
  const stepY = (grids.y.step ?? (grids.y.max - grids.y.min) / KEY_STEPS) * size;

  if (typeof along === 'function') {
    return constrain([at[0] + (direction[0] + direction[1]) * stepX, at[1]], constraint);
  }

  return constrain([at[0] + direction[0] * stepX, at[1] + direction[1] * stepY], constraint);
}

type Live = {
  readonly scene: SceneContextValue;
  readonly constraint: Constraint;
  /** Reports a move: writes the bound params, then tells `onMove`. */
  readonly move: (position: ScenePosition, details: ScenePointMoveDetails) => void;
};

/**
 * A point at a position in the scene, with optional text beside it. Give it `sets` or `onMove` and the reader grabs it
 * with a pointer, or moves it with the arrow keys while it is the keyboard cursor. It follows the pointer at once and
 * eases only when the application moves it.
 */
export function ScenePoint({
  id,
  at,
  label,
  text,
  tone,
  emphasis,
  isShown = true,
  isActive = false,
  onMove,
  sets,
  snap,
  along,
  pace,
  labels: labelInput,
}: ScenePointProps): ReactNode {
  const scene = useSceneContext();
  const marks = use(SceneMarksContext);
  const scopedTone = useScopedTone(id);
  const labels = { ...planeLabels, ...labelInput };
  const [isDragging, setDragging] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const stop = useRef<(() => void) | null>(null);
  const lessonScope = use(LessonContext);
  const isMovable = onMove !== undefined || sets !== undefined;
  const bound = sets === undefined ? {} : boundParams({ id, sets, scope: lessonScope, labels });
  const params = typeof bound === 'string' ? {} : bound;
  const isOnlyX = params.x !== undefined && params.y === undefined;
  const isOnlyY = params.y !== undefined && params.x === undefined;
  const boundAlong = isOnlyY ? 'y' : undefined;

  const constraint: Constraint = {
    at,
    grids: { x: gridOf(scene.domain.x, snap, params.x), y: gridOf(scene.domain.y, snap, params.y) },
    along: along ?? (isOnlyX ? 'x' : boundAlong),
  };

  function move(position: ScenePosition, details: ScenePointMoveDetails): void {
    const writes = Object.fromEntries(
      (['x', 'y'] as const).flatMap((axis, index) => {
        const name = sets?.[axis];

        return name === undefined || params[axis] === undefined ? [] : [[name, position[index]]];
      }),
    );

    if (lessonScope !== null && Object.keys(writes).length > 0) {
      lessonScope.api.setParams(writes, details);
    }

    onMove?.(position, details);
  }

  const live = useRef<Live>({ scene, constraint, move });
  const unlabelled = isMovable && label === undefined ? fillLabel(labels.pointLabel, { id }) : undefined;
  const problem = typeof bound === 'string' ? bound : unlabelled;
  const [across, up] = at;

  const object = useSceneObject({
    id,
    kind: 'point',
    frame: { x: across, y: up, width: POINT_RADIUS * 2, height: POINT_RADIUS * 2 },
    isFloating: true,
    values: {},
    shape: 'circle',
    label: isMovable && label !== undefined ? `${label}${labels.pointMovable}` : label,
    isShown,
    isActive,
    emphasis,
    problem,
    pace: isDragging ? 'instant' : pace,
  });

  const isDrawn = object.isVisible && problem === undefined;

  useObstacle({ id, line: isDrawn ? [{ x: across, y: up }] : [] });

  const isCursor = marks.cursor === id;
  const isKeyed = isMovable && isCursor && object.isVisible;

  useEffect(() => {
    live.current = { scene, constraint, move };
  });

  useEffect(() => () => stop.current?.(), []);

  useEffect(() => {
    if (!isKeyed) {
      return;
    }

    function onKey(event: KeyboardEvent): void {
      const figure = wrapper.current?.closest('figure');
      const { target } = event;
      const isPlot = target instanceof Element && figure?.contains(target) === true && target.matches(PLOT);
      const next = isPlot ? keyMove(event, live.current.constraint) : undefined;

      if (next === undefined) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const current = live.current.constraint.at;

      if (next[0] !== current[0] || next[1] !== current[1]) {
        live.current.move(next, { reason: 'step-key', event });
      }
    }

    document.addEventListener('keydown', onKey, true);

    return () => document.removeEventListener('keydown', onKey, true);
  }, [isKeyed]);

  function onMouseDown(event: ReactMouseEvent): void {
    event.preventDefault();
    object.focusPlot();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    const element = event.currentTarget;

    if (!isMovable || event.button !== 0) {
      return;
    }

    const box = element.getBoundingClientRect();
    const grab = { x: box.left + box.width / 2 - event.clientX, y: box.top + box.height / 2 - event.clientY };
    const start = live.current.constraint.at;

    stop.current?.();

    stop.current = bindDrag(element, event.nativeEvent, {
      threshold: dragThreshold,
      cancelOnEscape: true,
      onStart: () => {
        setDragging(true);
      },
      onMove: ({ x: pointerX, y: pointerY, event: moved }) => {
        const stage = element.parentElement?.getBoundingClientRect();
        const { scene: now, constraint: current, move: report } = live.current;

        if (stage === undefined) {
          return;
        }

        const raw: ScenePosition = [
          now.x.valueAt(pointerX + grab.x - stage.left),
          now.y.valueAt(pointerY + grab.y - stage.top),
        ];

        const next = constrain(raw, current);

        if (next[0] !== current.at[0] || next[1] !== current.at[1]) {
          report(next, { reason: 'drag', event: moved });
        }
      },
      onEnd: (end, isCanceled) => {
        setDragging(false);

        if (isCanceled) {
          live.current.move(start, { reason: 'drag', event: end });
        }
      },
    });
  }

  if (!scene.isInScene) {
    return <SceneOutside part="ScenePoint" />;
  }

  if (!isDrawn || object.rect === undefined) {
    return null;
  }

  const { x: dotX, y: dotY } = rectCenter(object.rect);
  const resolved = tone ?? scopedTone ?? 'series1';

  return (
    <>
      <PlaneMarks id={id} layer="front" opacity={object.values.opacity}>
        <DotMark
          x={dotX}
          y={dotY}
          tone={resolved}
          radius={POINT_RADIUS}
          emphasis={object.emphasis}
          isInspected={object.isInspected}
          isSelected={object.isSelected}
        />
        {text !== undefined && (
          <PlaneLabel
            owner={id}
            name="text"
            spots={spotsAround({ x: dotX, y: dotY, text })}
            lines={[[{ x: dotX, y: dotY }]]}
          />
        )}
      </PlaneMarks>
      {label !== undefined && isShown && (
        <div
          ref={wrapper}
          data-scene-point={id}
          onMouseDown={onMouseDown}
          onPointerDown={onPointerDown}
          {...stylex.props(
            styles.target(`translate(${dotX - HIT_HALF}px, ${dotY - HIT_HALF}px)`),
            isMovable && styles.movable,
            isDragging && styles.dragging,
          )}
        >
          <ChartMark
            value={id}
            render={<div />}
            {...stylex.props(styles.mark, ...sceneOutlines({ ...object, isInspected: false, isSelected: false }))}
          />
        </div>
      )}
    </>
  );
}
