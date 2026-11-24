import type { ReactNode } from 'react';
import { useScopedTone } from '../../../../charts/src/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { linePath, LinkMark, PlotClip } from '../../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import type { Pace } from '../../time/tween.ts';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
import type { SceneDataPoint, ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { useObstacle } from '../scene-obstacles.ts';
import { fillLabel } from '../scene-validate.ts';
import { PlaneHit, PlaneMarks } from './plane-hit.tsx';
import { PlaneLabel, spotsAround } from './plane-label.tsx';
import { planeLabels } from './plane-labels.ts';
import type { ScenePlaneLabels } from './plane-labels.ts';
import { insideBox, planeThicknesses } from './plane-math.ts';
import type { ScenePlaneThickness } from './plane-math.ts';

export type SceneVectorProps = {
  /** Stable across states: the vector with this id eases its ends to their new places. */
  readonly id: string;
  /** Where the arrow points, in the scene's data units. */
  readonly to: ScenePosition;
  /** Where the arrow starts. Defaults to the origin. */
  readonly from?: ScenePosition | undefined;
  /** The readout sentence. With one, the arrow keys reach the vector. */
  readonly label?: string | undefined;
  /** Short text beside the arrow's head, placed where it touches no curve. */
  readonly text?: string | undefined;
  /** The hue of the arrow. Left out, the tone scope's tone for the id, or the second series hue. */
  readonly tone?: ChartTone | undefined;
  /** `context` draws the vector gray; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** Dashed for a vector that is modelled or proposed, such as a step not yet taken. */
  readonly isDashed?: boolean | undefined;
  /** The stroke width by name. Defaults to `regular`. */
  readonly thickness?: ScenePlaneThickness | undefined;
  /** False fades the vector out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  /** True keeps the vector at full strength while the rest recede. */
  readonly isActive?: boolean | undefined;
  /** Overrides the scene's pace for this vector. */
  readonly pace?: Pace | undefined;
  readonly labels?: Partial<ScenePlaneLabels> | undefined;
};

const ORIGIN: ScenePosition = [0, 0];
const ARROW_LENGTH = 10;
const ARROW_HALF = 5;
const HEAD_GAP = 4;
const INSPECTED_EXTRA = 1;
const MIDDLE = 0.5;

function unitBetween(from: SceneDataPoint, to: SceneDataPoint): SceneDataPoint {
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  return length === 0 ? { x: 1, y: 0 } : { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/**
 * An arrow in the scene from one position to another: a gradient, a step, a velocity. Move either end and the arrow
 * eases there. Give it `text` to name its head, and a `label` to make it an item the reader can inspect.
 */
export function SceneVector({
  id,
  to,
  from = ORIGIN,
  label,
  text,
  tone,
  emphasis,
  isDashed = false,
  thickness = 'regular',
  isShown = true,
  isActive = false,
  pace,
  labels: labelInput,
}: SceneVectorProps): ReactNode {
  const scene = useSceneContext();
  const scopedTone = useScopedTone(id);
  const labels = { ...planeLabels, ...labelInput };
  const isFinite = [...from, ...to].every((value) => Number.isFinite(value));
  const ends = isFinite ? { fx: from[0], fy: from[1], tx: to[0], ty: to[1] } : { fx: 0, fy: 0, tx: 0, ty: 0 };

  const [centerX, centerY] = insideBox([(ends.fx + ends.tx) * MIDDLE, (ends.fy + ends.ty) * MIDDLE], scene.domain);

  const object = useSceneObject({
    id,
    kind: 'vector',
    frame: { x: centerX, y: centerY, width: 0, height: 0 },
    isFloating: true,
    values: ends,
    label,
    isShown,
    isActive,
    emphasis,
    problem: isFinite ? undefined : fillLabel(labels.notFinite, { kind: 'vector', id }),
    pace,
  });

  useObstacle({
    id,
    line:
      object.isVisible && isFinite
        ? [
            { x: object.values.fx, y: object.values.fy },
            { x: object.values.tx, y: object.values.ty },
          ]
        : [],
  });

  if (!scene.isInScene) {
    return <SceneOutside part="SceneVector" />;
  }

  if (!object.isVisible || !isFinite) {
    return null;
  }

  const { values } = object;
  const start = { x: scene.x.position(values.fx), y: scene.y.position(values.fy) };
  const tip = { x: scene.x.position(values.tx), y: scene.y.position(values.ty) };
  const direction = unitBetween(start, tip);
  const back = { x: tip.x - direction.x * ARROW_LENGTH, y: tip.y - direction.y * ARROW_LENGTH };
  const left = { x: back.x - direction.y * ARROW_HALF, y: back.y + direction.x * ARROW_HALF };
  const right = { x: back.x + direction.y * ARROW_HALF, y: back.y - direction.x * ARROW_HALF };
  const shaft = linePath([start, tip]);
  const path = `${shaft}${linePath([left, tip, right])}`;
  const width = planeThicknesses[thickness] + (object.isInspected ? INSPECTED_EXTRA : 0);
  const resolved = tone ?? scopedTone ?? 'series2';

  return (
    <PlaneMarks id={id} layer="front" opacity={values.opacity}>
      <PlotClip box={scene.box}>
        <LinkMark
          d={path}
          tone={resolved}
          width={width}
          stroke={isDashed ? 'dashed' : 'solid'}
          emphasis={object.emphasis}
        />
        <PlaneHit id={id} d={shaft} hasLabel={label !== undefined && isShown} isCursor={object.isCursor} />
      </PlotClip>
      {text !== undefined && (
        <PlaneLabel
          owner={id}
          name="text"
          spots={spotsAround({ x: tip.x + direction.x * HEAD_GAP, y: tip.y + direction.y * HEAD_GAP, text })}
          lines={[[start, tip]]}
        />
      )}
    </PlaneMarks>
  );
}
