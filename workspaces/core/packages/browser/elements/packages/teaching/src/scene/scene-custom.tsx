import type { ReactNode } from 'react';
import { chartToneColors } from '../../../charts/src/index.ts';
import type { ChartTone } from '../../../charts/src/index.ts';
import type { ContinuousScale, PlotBox, ToneInput } from '../../../charts/src/plot/index.ts';
import { useSceneContext } from './scene-context.ts';
import type { SceneView } from './scene-geometry.ts';
import { SceneLayer, SceneOutside } from './scene-layer.tsx';
import type { SceneLayerName } from './scene-layer.tsx';

/** What a custom drawing receives, in this frame. */
export type SceneDrawing = {
  /** Data x to plot pixels, through the camera. */
  readonly x: ContinuousScale;
  /** Data y to plot pixels, through the camera. y grows upward. */
  readonly y: ContinuousScale;
  /** The drawing area in plot pixels. */
  readonly box: PlotBox;
  /** The part of the data box the camera shows. */
  readonly view: SceneView;
  /** Resolves a record's tone through the tone scope, as the scene's own parts do. */
  readonly tone: (input: ToneInput) => ChartTone;
  /** The color of a tone, for a `fill` or `stroke`. */
  readonly color: (tone: ChartTone) => string;
};

export type SceneCustomProps = {
  /** Under the wires, or above them. Both lie under the nodes. Defaults to `front`. */
  readonly layer?: Exclude<SceneLayerName, 'wires'> | undefined;
  /** Returns SVG in plot pixels. It is called again on every camera frame. */
  readonly children: (drawing: SceneDrawing) => ReactNode;
};

/**
 * SVG the scene lacks, drawn with the scene's scales, box and tones so it moves with the camera: an axis, a decision
 * boundary, a shaded region. Use the kernel marks inside it so channels keep their meaning.
 */
export function SceneCustom({ layer = 'front', children }: SceneCustomProps): ReactNode {
  const scene = useSceneContext();

  if (!scene.isInScene) {
    return <SceneOutside part="SceneCustom" />;
  }

  return (
    <SceneLayer layer={layer}>
      {children({
        x: scene.x,
        y: scene.y,
        box: scene.box,
        view: scene.view,
        tone: scene.tone,
        color: (tone) => chartToneColors[tone],
      })}
    </SceneLayer>
  );
}
