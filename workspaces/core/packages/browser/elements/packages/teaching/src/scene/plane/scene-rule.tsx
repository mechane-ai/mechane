import type { ReactNode } from 'react';
import { useScopedTone } from '../../../../charts/src/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { linePath, PlotClip, RuleMark } from '../../../../charts/src/plot/index.ts';
import type { LabelSpot, MarkEmphasis, PlotBox } from '../../../../charts/src/plot/index.ts';
import type { Pace } from '../../time/tween.ts';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { useObstacle } from '../scene-obstacles.ts';
import { fillLabel } from '../scene-validate.ts';
import { PlaneHit, PlaneMarks } from './plane-hit.tsx';
import { PlaneLabel } from './plane-label.tsx';
import { planeLabels } from './plane-labels.ts';
import type { ScenePlaneLabels } from './plane-labels.ts';
import { insideDomain } from './plane-math.ts';

export type SceneRuleProps = {
  /** Stable across states: the rule with this id eases to its new value. */
  readonly id: string;
  /** Draws a vertical line at this x value. Give this or `y`. */
  readonly x?: number | undefined;
  /** Draws a horizontal line at this y value. Give this or `x`. */
  readonly y?: number | undefined;
  /** The readout sentence. With one, the arrow keys reach the rule. */
  readonly label?: string | undefined;
  /** Short text at the rule's end, such as "threshold" or "limit", placed where it touches no curve. */
  readonly text?: string | undefined;
  /** The hue of the line. Left out, the tone scope's tone for the id, or the reference gray. */
  readonly tone?: ChartTone | undefined;
  /** `context` draws the rule gray; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** A rule is a reference, so it is dashed. Pass false for a solid one. */
  readonly isDashed?: boolean | undefined;
  /** False fades the rule out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  /** True keeps the rule at full strength while the rest recede. */
  readonly isActive?: boolean | undefined;
  /** Overrides the scene's pace for this rule. */
  readonly pace?: Pace | undefined;
  readonly labels?: Partial<ScenePlaneLabels> | undefined;
};

const LIFT = 6;
const DROP = 14;
const INSET = 6;
const TOP_LINE = 12;
const ALONG_SHARES = [0.75, 0.25, 0.5] as const;

type RuleSpots = { readonly box: PlotBox; readonly at: number; readonly text: string };

function horizontalSpots({ box, at, text }: RuleSpots): ReadonlyArray<LabelSpot> {
  const along = ALONG_SHARES.map((share) => box.left + box.innerWidth * share);

  return [at - LIFT, at + DROP].flatMap((level) => [
    { x: box.right - INSET, y: level, anchor: 'end' as const, text },
    { x: box.left + INSET, y: level, anchor: 'start' as const, text },
    ...along.map((across) => ({ x: across, y: level, anchor: 'middle' as const, text })),
  ]);
}

function verticalSpots({ box, at, text }: RuleSpots): ReadonlyArray<LabelSpot> {
  const along = ALONG_SHARES.map((share) => box.top + box.innerHeight * share);

  return [at + INSET, at - INSET].flatMap((side) => {
    const anchor = side > at ? ('start' as const) : ('end' as const);

    return [
      { x: side, y: box.top + TOP_LINE, anchor, text },
      { x: side, y: box.bottom - INSET, anchor, text },
      ...along.map((down) => ({ x: side, y: down, anchor, text })),
    ];
  });
}

/**
 * A horizontal or vertical reference line at a value, with a short label at its end: a threshold, a limit, an
 * asymptote. It is dashed because it is a reference, not an observation. Move its value and it eases there.
 */
export function SceneRule({
  id,
  x,
  y,
  label,
  text,
  tone,
  emphasis,
  isDashed = true,
  isShown = true,
  isActive = false,
  pace,
  labels: labelInput,
}: SceneRuleProps): ReactNode {
  const scene = useSceneContext();
  const scopedTone = useScopedTone(id);
  const labels = { ...planeLabels, ...labelInput };
  const isVertical = x !== undefined;
  const value = (isVertical ? x : y) ?? 0;
  const isOne = (x === undefined) !== (y === undefined);
  const isFinite = Number.isFinite(value);
  const [left, right] = scene.domain.x;
  const [bottom, top] = scene.domain.y;

  const problem = isOne ? undefined : fillLabel(labels.ruleAxis, { id });
  const shape = isFinite ? undefined : fillLabel(labels.notFinite, { kind: 'rule', id });

  const placed = insideDomain(isFinite ? value : 0, isVertical ? scene.domain.x : scene.domain.y);

  const object = useSceneObject({
    id,
    kind: 'rule',
    frame: isVertical
      ? { x: placed, y: (bottom + top) / 2, width: 0, height: 0 }
      : { x: (left + right) / 2, y: placed, width: 0, height: 0 },
    isFloating: true,
    values: { value: isFinite ? value : 0 },
    label,
    isShown,
    isActive,
    emphasis,
    problem: problem ?? shape,
    pace,
  });

  useObstacle({
    id,
    line: [
      isVertical ? { x: object.values.value, y: bottom } : { x: left, y: object.values.value },
      isVertical ? { x: object.values.value, y: top } : { x: right, y: object.values.value },
    ],
  });

  if (!scene.isInScene) {
    return <SceneOutside part="SceneRule" />;
  }

  if (!object.isVisible || problem !== undefined || shape !== undefined) {
    return null;
  }

  const { box } = scene;
  const eased = object.values.value;
  const at = isVertical ? scene.x.position(eased) : scene.y.position(eased);
  const stroke = isDashed ? 'dashed' : 'solid';
  const resolved = tone ?? scopedTone;

  const ends = isVertical
    ? { x1: at, y1: box.top, x2: at, y2: box.bottom }
    : { x1: box.left, y1: at, x2: box.right, y2: at };

  const path = linePath([
    { x: ends.x1, y: ends.y1 },
    { x: ends.x2, y: ends.y2 },
  ]);

  const spots = isVertical ? verticalSpots : horizontalSpots;

  return (
    <PlaneMarks id={id} layer="back" opacity={object.values.opacity * object.strength}>
      <PlotClip box={box}>
        <RuleMark {...ends} stroke={stroke} tone={resolved} />
        <PlaneHit id={id} d={path} hasLabel={label !== undefined && isShown} isCursor={object.isCursor} />
      </PlotClip>
      {text !== undefined && <PlaneLabel owner={id} name="text" spots={spots({ box, at, text })} />}
    </PlaneMarks>
  );
}
