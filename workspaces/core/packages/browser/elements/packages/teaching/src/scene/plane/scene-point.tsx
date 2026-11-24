import * as stylex from '@stylexjs/stylex';
import { bindDrag, dragThreshold } from '@ui-sdk/core';
import { clamp, scrubTo, stepFromKey } from '@ui-sdk/core/number';
import { use, useEffect, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { formatValue, useScopedTone } from '../../../../charts/src/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { ChartMark, DotMark } from '../../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import { colors, controls } from '../../../../foundations/src/tokens.stylex.ts';
import type { NumberParam } from '../../lesson/define-lesson.ts';
import { LessonContext } from '../../lesson/lesson-context.ts';
import type { LessonScope } from '../../lesson/lesson-context.ts';
import type { Pace } from '../../time/tween.ts';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
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

/** Why a point moved: a pointer drag, or a key. A cancelled drag reports `drag` with the starting position. */
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
   * Makes the point a slider the reader drags or reaches with Tab and moves with the keys. It is told where the reader
   * wants the point; the point stays where `at` says until the application moves it.
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
/** How an axis no param owns writes its value for the slider's spoken value. */
const FREE_FORMAT = { maximumFractionDigits: 2 } as const;
/** The keys that move the y axis of a point that moves on both. */
const verticalKeys: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']);

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
  movable: {
    'cursor': 'grab',
    'touchAction': 'none',
    'borderRadius': '50%',
    'outlineStyle': 'none',
    ':focus-visible': { outlineWidth: controls.focusWidth, outlineStyle: 'solid', outlineColor: colors.focus },
  },
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

/** The axes a movable point moves on: one it follows, or both when nothing keeps it to a line. */
function movingAxes(along: ScenePointAlong | undefined): ReadonlyArray<'x' | 'y'> {
  if (along === undefined) {
    return ['x', 'y'];
  }

  return along === 'y' ? ['y'] : ['x'];
}

/**
 * The position a key asks for, as on a slider: the arrows step, Shift and Page Up or Down take ten steps, and Home and
 * End go to the ends. On a point that moves on both axes, Up, Down and the page keys move y and the rest move x.
 */
function keyMove(event: KeyboardEvent, constraint: Constraint): ScenePosition | undefined {
  const { at, grids, along } = constraint;
  const axes = movingAxes(along);
  const [first] = axes;
  const axis = axes.length > 1 && verticalKeys.has(event.key) ? 'y' : (first ?? 'x');
  const arrows = axes.length > 1 ? (axis === 'y' ? 'vertical' : 'horizontal') : 'all';
  const step = stepFromKey(event, { arrows, orientation: axis === 'y' ? 'vertical' : 'horizontal' });
  const hasModifier = event.ctrlKey || event.metaKey;

  if (step === null || hasModifier) {
    return undefined;
  }

  const grid = grids[axis];
  const index = axis === 'x' ? 0 : 1;
  const current = at[index];
  const unit = grid.step ?? (grid.max - grid.min) / KEY_STEPS;
  const bounded = step.bound === 'min' ? grid.min : grid.max;
  const stepped = current + (step.direction ?? 0) * unit * (step.size === 'large' ? LARGE_STEP : 1);
  const value = step.bound === undefined ? stepped : bounded;

  return constrain(axis === 'x' ? [value, at[1]] : [at[0], value], constraint);
}

/** What the slider says its value is: each axis it moves on, a bound one by its param's name and format. */
function spokenValue({
  at,
  axes,
  params,
  locale,
  labels,
}: {
  readonly at: ScenePosition;
  readonly axes: ReadonlyArray<'x' | 'y'>;
  readonly params: { readonly x?: NumberParam; readonly y?: NumberParam };
  readonly locale: string;
  readonly labels: ScenePlaneLabels;
}): string {
  return axes
    .map((axis) => {
      const param = params[axis];
      const value = at[axis === 'x' ? 0 : 1];
      const written = formatValue({ value, locale, format: param?.format ?? FREE_FORMAT });

      return param === undefined ? written : fillLabel(labels.pointValue, { name: param.label, value: written });
    })
    .join(', ');
}

type Live = {
  readonly scene: SceneContextValue;
  readonly constraint: Constraint;
  /** Reports a move: writes the bound params, then tells `onMove`. */
  readonly move: (position: ScenePosition, details: ScenePointMoveDetails) => void;
};

/**
 * A point at a position in the scene, with optional text beside it. Give it `sets` or `onMove` and it is a slider: the
 * reader drags it, or reaches it with Tab and moves it with the arrow keys, Home and End. It eases only when moved.
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
  const scopedTone = useScopedTone(id);
  const labels = { ...planeLabels, ...labelInput };
  const [isDragging, setDragging] = useState(false);
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

  useEffect(() => {
    live.current = { scene, constraint, move };
  });

  useEffect(() => () => stop.current?.(), []);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const next = isMovable ? keyMove(event.nativeEvent, constraint) : undefined;

    if (next === undefined) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (next[0] !== at[0] || next[1] !== at[1]) {
      move(next, { reason: 'step-key', event: event.nativeEvent });
    }
  }

  function onMouseDown(event: ReactMouseEvent<HTMLDivElement>): void {
    event.preventDefault();

    if (isMovable) {
      event.currentTarget.focus({ preventScroll: true });
    } else {
      object.focusPlot();
    }
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
  const axes = movingAxes(constraint.along);
  const primary = axes.length === 1 && axes[0] === 'y' ? 'y' : 'x';

  const slider = isMovable
    ? {
        'role': 'slider',
        'tabIndex': 0,
        'aria-label': label,
        'aria-orientation': primary === 'y' ? ('vertical' as const) : ('horizontal' as const),
        'aria-valuenow': at[primary === 'x' ? 0 : 1],
        'aria-valuemin': constraint.grids[primary].min,
        'aria-valuemax': constraint.grids[primary].max,
        'aria-valuetext': spokenValue({ at, axes, params, locale: scene.locale, labels }),
        onKeyDown,
      }
    : {};

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
          {...slider}
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
