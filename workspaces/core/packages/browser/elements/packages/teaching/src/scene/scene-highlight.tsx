import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../charts/src/index.ts';
import type { ChartTone } from '../../../charts/src/index.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { useSceneFrames, useSceneObject } from './scene-context.ts';
import { padRect } from './scene-geometry.ts';
import { SceneLayer, SceneOutside } from './scene-layer.tsx';

export type SceneHighlightProps = {
  /** The id or ids to draw attention to. The objects themselves are not changed. */
  readonly of: string | ReadonlyArray<string>;
  /** Defaults to `highlight:` and the ids. */
  readonly id?: string | undefined;
  /** A hue for the halo, when it should match a thing the prose names. Left out, the halo is drawn in ink. */
  readonly tone?: ChartTone | undefined;
  /** The halo's reach beyond each object, in pixels. Defaults to 6. */
  readonly padding?: number | undefined;
  /** False fades the halo out. Toggle it to point at the objects the prose names. */
  readonly isShown?: boolean | undefined;
};

const RADIUS = 8;

const styles = stylex.create({
  halo: (color: string, opacity: number) => ({
    fill: `color-mix(in srgb, ${color} 12%, transparent)`,
    stroke: color,
    strokeWidth: 1.5,
    opacity,
    vectorEffect: 'non-scaling-stroke',
    pointerEvents: 'none',
  }),
});

/**
 * A halo behind scene objects that draws the reader's eye without changing them: the node a sentence is about, or the
 * path a value takes. It follows its objects and fades in and out with `isShown`.
 */
export function SceneHighlight({ of, id, tone, padding = 6, isShown = true }: SceneHighlightProps): ReactNode {
  const ids = typeof of === 'string' ? [of] : of;
  const targets = useSceneFrames(ids);

  const object = useSceneObject({
    id: id ?? `highlight:${ids.join(',')}`,
    kind: 'highlight',
    values: {},
    attaches: ids,
    isShown,
  });

  if (!object.scene.isInScene) {
    return <SceneOutside part="SceneHighlight" />;
  }

  if (object.values.opacity <= 0) {
    return null;
  }

  const color = tone === undefined ? colors.ink : chartToneColors[tone];

  return (
    <SceneLayer layer="back">
      {targets.map((target, index) => {
        const rect = target?.rect;

        if (target === undefined || rect === undefined) {
          return null;
        }

        const halo = padRect(rect, padding);
        const isRound = target.member.shape === 'circle';

        return (
          <rect
            key={ids[index]}
            x={halo.left}
            y={halo.top}
            width={halo.right - halo.left}
            height={halo.bottom - halo.top}
            rx={isRound ? (halo.right - halo.left) / 2 : RADIUS}
            ry={isRound ? (halo.bottom - halo.top) / 2 : RADIUS}
            {...stylex.props(styles.halo(color, object.values.opacity * target.values.opacity))}
          />
        );
      })}
    </SceneLayer>
  );
}
