import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useScopedTone } from '../../../../charts/src/index.ts';
import type { ChartTone, NumericDomain } from '../../../../charts/src/index.ts';
import { AreaMark, areaPath, linePath, LinkMark, PlotClip } from '../../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import type { Pace } from '../../time/tween.ts';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
import type { ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { useObstacle } from '../scene-obstacles.ts';
import { fillLabel } from '../scene-validate.ts';
import { PlaneHit, PlaneMarks } from './plane-hit.tsx';
import { planeLabels } from './plane-labels.ts';
import type { ScenePlaneLabels } from './plane-labels.ts';
import {
  curveResolutions,
  gridXs,
  insideDomain,
  interpolateAt,
  planeLimits,
  planeThicknesses,
  visibleRun,
} from './plane-math.ts';
import type { SceneCurveResolution, ScenePlaneThickness } from './plane-math.ts';

export type SceneCurveProps = {
  /** Stable across states: the curve with this id eases from its old shape to the new one. */
  readonly id: string;
  /** The curve as data: `[x, y]` pairs with strictly increasing x. Give this or `of`. */
  readonly points?: ReadonlyArray<ScenePosition> | undefined;
  /** The curve as a function of x, sampled across the scene's x range. Give this or `points`. */
  readonly of?: ((across: number) => number) | undefined;
  /** How many samples `of` takes. Defaults to `regular`. Samples are also how a curve eases between shapes. */
  readonly resolution?: SceneCurveResolution | undefined;
  /** The readout sentence. With one, the arrow keys reach the curve. */
  readonly label?: string | undefined;
  /** The hue that names the curve. Left out, the tone scope's tone for the id, or the first series hue. */
  readonly tone?: ChartTone | undefined;
  /** `context` draws the curve gray; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** Dashed for a curve that is modelled: a fit, a projection or a baseline. */
  readonly isDashed?: boolean | undefined;
  /** The stroke width by name. Defaults to `regular`. */
  readonly thickness?: ScenePlaneThickness | undefined;
  /** Fills the area between the curve and this y value with a pale wash of its tone. */
  readonly fillTo?: number | undefined;
  /** False fades the curve out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  /** True keeps the curve at full strength while the rest recede. */
  readonly isActive?: boolean | undefined;
  /** Overrides the scene's pace for this curve. */
  readonly pace?: Pace | undefined;
  readonly labels?: Partial<ScenePlaneLabels> | undefined;
};

const INSPECTED_EXTRA = 1;
const MIDDLE = 0.5;

type CurveKey = `y${number}` | 'from' | 'to' | 'base';

type CurveSample = {
  readonly ys: ReadonlyArray<number>;
  readonly from: number;
  readonly to: number;
  readonly problem: string | undefined;
};

type SampleInput = {
  readonly id: string;
  readonly points: ReadonlyArray<ScenePosition> | undefined;
  readonly of: ((across: number) => number) | undefined;
  readonly xs: ReadonlyArray<number>;
  readonly domain: NumericDomain;
  readonly labels: ScenePlaneLabels;
};

function isStrictlyIncreasing(points: ReadonlyArray<ScenePosition>): boolean {
  const isFinite = points.every(([across, up]) => Number.isFinite(across) && Number.isFinite(up));

  return isFinite && points.every((point, index) => index === 0 || point[0] > (points[index - 1]?.[0] ?? 0));
}

/** The curve's y values at the shared sample positions, and the x range it covers. */
function sampleCurve({ id, points, of, xs, domain, labels }: SampleInput): CurveSample {
  const flat = { ys: xs.map(() => 0), from: domain[0], to: domain[1] };

  if (of !== undefined && points === undefined) {
    const ys = xs.map((across) => of(across));
    const bad = ys.findIndex((value) => !Number.isFinite(value));

    return bad === -1
      ? { ...flat, ys, problem: undefined }
      : { ...flat, problem: fillLabel(labels.curveValue, { id, x: String(xs[bad]) }) };
  }

  if (points === undefined || of !== undefined) {
    return { ...flat, problem: fillLabel(labels.curveSource, { id }) };
  }

  if (points.length > planeLimits.curvePoints) {
    return { ...flat, problem: fillLabel(labels.curveTooMany, { id, limit: String(planeLimits.curvePoints) }) };
  }

  if (points.length < 2 || !isStrictlyIncreasing(points)) {
    return { ...flat, problem: fillLabel(labels.curveOrder, { id }) };
  }

  const from = Math.max(domain[0], points[0]?.[0] ?? domain[0]);
  const to = Math.max(from, Math.min(domain[1], points.at(-1)?.[0] ?? domain[1]));

  return { ys: xs.map((across) => interpolateAt(points, across)), from, to, problem: undefined };
}

/**
 * A curve in the scene's data box, from points or from a function of x: a function a lesson explains, a loss, a fit.
 * Give it new points or a new function and it eases from the old shape to the new one. Wires and callouts that name it
 * attach at its middle.
 */
export function SceneCurve({
  id,
  points,
  of,
  resolution = 'regular',
  label,
  tone,
  emphasis,
  isDashed = false,
  thickness = 'regular',
  fillTo,
  isShown = true,
  isActive = false,
  pace,
  labels: labelInput,
}: SceneCurveProps): ReactNode {
  const scene = useSceneContext();
  const scopedTone = useScopedTone(id);
  const [low, high] = scene.domain.x;
  const xs = useMemo(() => gridXs([low, high], curveResolutions[resolution]), [low, high, resolution]);

  const sample = useMemo(
    () => sampleCurve({ id, points, of, xs, domain: [low, high], labels: { ...planeLabels, ...labelInput } }),
    [id, points, of, xs, low, high, labelInput],
  );

  const target: Readonly<Record<CurveKey, number>> = {
    ...Object.fromEntries(sample.ys.map((value, index) => [`y${index}`, value])),
    from: sample.from,
    to: sample.to,
    base: fillTo ?? 0,
  };

  const middle = (sample.from + sample.to) * MIDDLE;

  const height = interpolateAt(
    xs.map((across, index): ScenePosition => [across, sample.ys[index] ?? 0]),
    middle,
  );

  const object = useSceneObject({
    id,
    kind: 'curve',
    frame: { x: middle, y: insideDomain(height, scene.domain.y), width: 0, height: 0 },
    isFloating: true,
    values: target,
    label,
    isShown,
    isActive,
    emphasis,
    problem: sample.problem,
    pace,
  });

  const shown = object.values;
  const eased = xs.map((_, index) => shown[`y${index}`] ?? 0);
  const run = visibleRun({ xs, ys: eased, from: shown.from, to: shown.to });

  useObstacle({ id, line: object.isVisible && sample.problem === undefined ? run : [] });

  if (!object.scene.isInScene) {
    return <SceneOutside part="SceneCurve" />;
  }

  if (!object.isVisible || sample.problem !== undefined) {
    return null;
  }

  const pixels = run.map((point) => ({ x: scene.x.position(point.x), y: scene.y.position(point.y) }));
  const path = linePath(pixels);
  const floor = scene.y.position(shown.base);
  const width = planeThicknesses[thickness] + (object.isInspected ? INSPECTED_EXTRA : 0);
  const resolved = tone ?? scopedTone ?? 'series1';

  return (
    <PlaneMarks id={id} layer="wires" opacity={shown.opacity}>
      <PlotClip box={scene.box}>
        {fillTo !== undefined && (
          <AreaMark
            d={areaPath(pixels.map((point) => ({ x: point.x, y0: floor, y1: point.y })))}
            tone={resolved}
            emphasis={object.emphasis}
            isPale
          />
        )}
        <LinkMark
          d={path}
          tone={resolved}
          width={width}
          stroke={isDashed ? 'dashed' : 'solid'}
          emphasis={object.emphasis}
        />
        <PlaneHit id={id} d={path} hasLabel={label !== undefined && isShown} isCursor={object.isCursor} />
      </PlotClip>
    </PlaneMarks>
  );
}
