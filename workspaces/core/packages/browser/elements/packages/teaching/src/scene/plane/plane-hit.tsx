import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { ChartMark, chartStyles } from '../../../../charts/src/plot/index.ts';
import { SceneLayer } from '../scene-layer.tsx';
import type { SceneLayerName } from '../scene-layer.tsx';

const HIT_WIDTH = 14;

const styles = stylex.create({
  fade: (opacity: number) => ({ opacity: Math.max(0, Math.min(1, opacity)) }),
  stroke: {
    fill: 'none',
    stroke: 'transparent',
    strokeWidth: HIT_WIDTH,
    pointerEvents: 'stroke',
    outlineStyle: 'none',
  },
  fill: { fill: 'transparent', stroke: 'none', pointerEvents: 'fill', outlineStyle: 'none' },
  cursor: { fill: 'none', pointerEvents: 'none' },
});

/** Draws plane marks into one scene layer, faded to the part's own opacity. Nothing is drawn outside a scene. */
export function PlaneMarks({
  id,
  layer,
  opacity,
  children,
}: {
  readonly id: string;
  readonly layer: SceneLayerName;
  readonly opacity: number;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <SceneLayer layer={layer}>
      <g data-scene-plane={id} {...stylex.props(styles.fade(opacity))}>
        {children}
      </g>
    </SceneLayer>
  );
}

/**
 * The part of a mark a pointer can reach and the keyboard cursor's dashed edge. A part with a label is an item the
 * reader inspects, so its path takes pointer events; the cursor draws along the same path.
 */
export function PlaneHit({
  id,
  d,
  hasLabel,
  isCursor,
  reach = 'stroke',
}: {
  readonly id: string;
  /** The SVG path of the mark. */
  readonly d: string;
  readonly hasLabel: boolean;
  readonly isCursor: boolean;
  /** `stroke` for a line, `fill` for a region. */
  readonly reach?: 'stroke' | 'fill' | undefined;
}): ReactNode {
  return (
    <>
      {hasLabel && <ChartMark value={id} render={<path d={d} />} {...stylex.props(styles[reach])} />}
      {isCursor && <path d={d} {...stylex.props(chartStyles.shapeCursor, styles.cursor)} />}
    </>
  );
}
