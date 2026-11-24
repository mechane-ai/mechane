import type { ReactNode } from 'react';
import { useScopedTone } from '../../../../charts/src/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { BandMark, linePath, PlotClip } from '../../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import type { Pace } from '../../time/tween.ts';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
import type { ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { fillLabel } from '../scene-validate.ts';
import { PlaneHit, PlaneMarks } from './plane-hit.tsx';
import { PlaneLabel } from './plane-label.tsx';
import { planeLabels } from './plane-labels.ts';
import type { ScenePlaneLabels } from './plane-labels.ts';
import { centroid, insideBox, planeLimits } from './plane-math.ts';
import type { DataBox } from './plane-math.ts';

export type SceneRegionProps = {
  /** Stable across states: the region with this id eases its corners to their new places. */
  readonly id: string;
  /** The band between two x values, over the box's whole height. Give one of this, `above`, `below` or `points`. */
  readonly between?: readonly [number, number] | undefined;
  /** Everything above this y value. */
  readonly above?: number | undefined;
  /** Everything below this y value. */
  readonly below?: number | undefined;
  /** A polygon, as corners in order. */
  readonly points?: ReadonlyArray<ScenePosition> | undefined;
  /** The readout sentence. With one, the arrow keys reach the region. */
  readonly label?: string | undefined;
  /** Short text inside the region, placed where it touches no curve. */
  readonly text?: string | undefined;
  /** The hue of the wash. Left out, the tone scope's tone for the id, or neutral. */
  readonly tone?: ChartTone | undefined;
  /** `context` draws the region gray; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** False fades the region out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  /** True keeps the region at full strength while the rest recede. */
  readonly isActive?: boolean | undefined;
  /** Overrides the scene's pace for this region. */
  readonly pace?: Pace | undefined;
  readonly labels?: Partial<ScenePlaneLabels> | undefined;
};

type CornerKey = `cx${number}` | `cy${number}`;

const MIN_CORNERS = 3;
const TEXT_TOP = 16;
const TEXT_BOTTOM = 8;
const TEXT_MIDDLE = 4;
const TEXT_SHARES = [0.5, 0.25, 0.75] as const;

/** The region's corners in data units. There are none when the props do not name exactly one shape. */
function cornersOf(
  props: Pick<SceneRegionProps, 'between' | 'above' | 'below' | 'points'>,
  box: DataBox,
): ReadonlyArray<ScenePosition> {
  const { between, above, below, points } = props;
  const named = [between, above, below, points].filter((shape) => shape !== undefined);
  const [left, right] = box.x;
  const [bottom, top] = box.y;

  if (named.length !== 1) {
    return [];
  }

  if (between !== undefined) {
    return [
      [between[0], bottom],
      [between[1], bottom],
      [between[1], top],
      [between[0], top],
    ];
  }

  if (above !== undefined) {
    return [
      [left, above],
      [right, above],
      [right, top],
      [left, top],
    ];
  }

  if (below !== undefined) {
    return [
      [left, bottom],
      [right, bottom],
      [right, below],
      [left, below],
    ];
  }

  return points ?? [];
}

function regionProblem({
  id,
  corners,
  labels,
}: {
  readonly id: string;
  readonly corners: ReadonlyArray<ScenePosition>;
  readonly labels: ScenePlaneLabels;
}): string | undefined {
  if (corners.length < MIN_CORNERS || corners.length > planeLimits.polygonPoints) {
    return fillLabel(labels.regionShape, { id });
  }

  const isFinite = corners.every(([across, up]) => Number.isFinite(across) && Number.isFinite(up));

  return isFinite ? undefined : fillLabel(labels.notFinite, { kind: 'region', id });
}

/**
 * A filled region of the plane: a band between two x values, everything above or below a value, or a polygon. It is a
 * pale wash in its tone, behind the curves. Use it for a zone a lesson names, such as overfitting or a safe range.
 */
export function SceneRegion({
  id,
  between,
  above,
  below,
  points,
  label,
  text,
  tone,
  emphasis,
  isShown = true,
  isActive = false,
  pace,
  labels: labelInput,
}: SceneRegionProps): ReactNode {
  const scene = useSceneContext();
  const scopedTone = useScopedTone(id);
  const labels = { ...planeLabels, ...labelInput };
  const corners = cornersOf({ between, above, below, points }, scene.domain);
  const problem = regionProblem({ id, corners, labels });
  const drawn = problem === undefined ? corners : [];

  const corner: Readonly<Record<CornerKey, number>> = Object.fromEntries(
    drawn.flatMap(([across, up], index) => [
      [`cx${index}`, across],
      [`cy${index}`, up],
    ]),
  );

  const middle = centroid(drawn.map(([across, up]) => ({ x: across, y: up })));
  const [centerX, centerY] = insideBox([middle.x, middle.y], scene.domain);

  const object = useSceneObject({
    id,
    kind: 'region',
    frame: { x: centerX, y: centerY, width: 0, height: 0 },
    isFloating: true,
    values: corner,
    label,
    isShown,
    isActive,
    emphasis,
    problem,
    pace,
  });

  if (!scene.isInScene) {
    return <SceneOutside part="SceneRegion" />;
  }

  if (!object.isVisible || problem !== undefined) {
    return null;
  }

  const { values } = object;

  const pixels = drawn.map((_, index) => ({
    x: scene.x.position(values[`cx${index}`] ?? 0),
    y: scene.y.position(values[`cy${index}`] ?? 0),
  }));

  const path = `${linePath(pixels)}Z`;
  const center = { x: scene.x.position(middle.x), y: scene.y.position(middle.y) };
  const top = Math.min(...pixels.map((point) => point.y));
  const bottom = Math.max(...pixels.map((point) => point.y));
  const resolved = tone ?? scopedTone ?? 'neutral';

  const near = Math.max(Math.min(...pixels.map((point) => point.x)), scene.box.left);
  const far = Math.min(Math.max(...pixels.map((point) => point.x)), scene.box.right);

  const levels = [
    Math.max(top, scene.box.top) + TEXT_TOP,
    center.y + TEXT_MIDDLE,
    Math.min(bottom, scene.box.bottom) - TEXT_BOTTOM,
  ];

  return (
    <PlaneMarks id={id} layer="back" opacity={values.opacity}>
      <PlotClip box={scene.box}>
        <BandMark d={path} tone={resolved} emphasis={object.emphasis} />
        <PlaneHit id={id} d={path} hasLabel={label !== undefined && isShown} isCursor={object.isCursor} reach="fill" />
      </PlotClip>
      {text !== undefined && (
        <PlaneLabel
          owner={id}
          name="text"
          spots={levels.flatMap((level) =>
            TEXT_SHARES.map((share) => ({ x: near + (far - near) * share, y: level, anchor: 'middle' as const, text })),
          )}
        />
      )}
    </PlaneMarks>
  );
}
