import type { ReactNode } from 'react';
import { formatValue, useScopedTone } from '../../../../charts/src/index.ts';
import type { ChartTone, ValueFormat } from '../../../../charts/src/index.ts';
import { RuleMark } from '../../../../charts/src/plot/index.ts';
import type { Pace } from '../../time/tween.ts';
import { useSceneContext, useSceneFrames, useSceneObject } from '../scene-context.ts';
import { rectCenter } from '../scene-geometry.ts';
import type { ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { fillLabel } from '../scene-validate.ts';
import { PlaneMarks } from './plane-hit.tsx';
import { PlaneLabel } from './plane-label.tsx';
import { planeLabels } from './plane-labels.ts';
import type { ScenePlaneLabels } from './plane-labels.ts';

export type SceneProjectionProps = {
  /** Stable across states. */
  readonly id: string;
  /** The id of a `ScenePoint`, or any placed object, to follow. The lines stay under it. Give this or `at`. */
  readonly of?: string | undefined;
  /** A fixed position to project, in the scene's data units. Give this or `of`. */
  readonly at?: ScenePosition | undefined;
  /** How the values written on the axes are formatted. Defaults to at most two decimals. */
  readonly format?: ValueFormat | undefined;
  /** The hue of the dashed lines. Left out, the tone scope's tone for the id, or neutral. */
  readonly tone?: ChartTone | undefined;
  /** False fades the projection out. */
  readonly isShown?: boolean | undefined;
  /** Overrides the scene's pace for this projection. */
  readonly pace?: Pace | undefined;
  readonly labels?: Partial<ScenePlaneLabels> | undefined;
};

const defaultFormat: ValueFormat = { maximumFractionDigits: 2 };
const INSET = 6;
const LIFT = 6;
const DROP = 14;

/**
 * Dashed lines from a point down to the x axis and across to the y axis, with its two values written where they meet
 * the axes. Use it to show what a point's position means: the input that went in and the value that came out.
 */
export function SceneProjection({
  id,
  of,
  at,
  format = defaultFormat,
  tone,
  isShown = true,
  pace,
  labels: labelInput,
}: SceneProjectionProps): ReactNode {
  const scene = useSceneContext();
  const scopedTone = useScopedTone(id);
  const labels = { ...planeLabels, ...labelInput };
  const followed = useSceneFrames(of === undefined ? [] : [of])[0];
  const isOne = (of === undefined) !== (at === undefined);

  const object = useSceneObject({
    id,
    kind: 'projection',
    frame: at === undefined ? undefined : { x: at[0], y: at[1], width: 0, height: 0 },
    isFloating: true,
    values: {},
    attaches: of === undefined ? [] : [of],
    isShown,
    problem: isOne ? undefined : fillLabel(labels.projectionSource, { id }),
    pace,
  });

  if (!scene.isInScene) {
    return <SceneOutside part="SceneProjection" />;
  }

  const source = followed === undefined ? object.rect : followed.rect;

  if (!object.isVisible || !isOne || source === undefined) {
    return null;
  }

  const { box, locale } = scene;
  const { x: dropX, y: dropY } = rectCenter(source);
  const resolved = tone ?? scopedTone ?? 'neutral';
  const across = formatValue({ value: scene.x.valueAt(dropX), locale, format });
  const up = formatValue({ value: scene.y.valueAt(dropY), locale, format });

  const drops = [
    [
      { x: dropX, y: dropY },
      { x: dropX, y: box.bottom },
    ],
    [
      { x: dropX, y: dropY },
      { x: box.left, y: dropY },
    ],
  ];

  return (
    <PlaneMarks id={id} layer="front" opacity={object.values.opacity}>
      <RuleMark x1={dropX} y1={dropY} x2={dropX} y2={box.bottom} stroke="dashed" tone={resolved} />
      <RuleMark x1={dropX} y1={dropY} x2={box.left} y2={dropY} stroke="dashed" tone={resolved} />
      <PlaneLabel
        owner={id}
        name="across"
        spots={[
          { x: dropX + INSET, y: box.bottom - INSET, anchor: 'start', text: across },
          { x: dropX - INSET, y: box.bottom - INSET, anchor: 'end', text: across },
        ]}
        lines={drops}
        isStrong
      />
      <PlaneLabel
        owner={id}
        name="up"
        spots={[
          { x: box.left + INSET, y: dropY - LIFT, anchor: 'start', text: up },
          { x: box.left + INSET, y: dropY + DROP, anchor: 'start', text: up },
        ]}
        lines={drops}
        isStrong
      />
    </PlaneMarks>
  );
}
