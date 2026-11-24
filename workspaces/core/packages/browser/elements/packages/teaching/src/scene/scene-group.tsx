import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors, useScopedTone } from '../../../charts/src/index.ts';
import type { ChartTone } from '../../../charts/src/index.ts';
import { ChartMark, chartStyles, LabelMark } from '../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../charts/src/plot/index.ts';
import { useSceneFrames, useSceneObject } from './scene-context.ts';
import { padRect, unionRect } from './scene-geometry.ts';
import { SceneLayer, SceneOutside } from './scene-layer.tsx';
import { sceneContextColor } from './scene-style.ts';

export type SceneGroupProps = {
  /** Stable across states: the outline with this id eases to its new members. */
  readonly id: string;
  /** The readout sentence and, unless `text` is set, the name drawn on the outline. */
  readonly label?: string | undefined;
  /** A shorter name to draw, when the label is a full sentence. */
  readonly text?: string | undefined;
  /** The ids of the objects the outline surrounds. It follows them as they move. */
  readonly around: ReadonlyArray<string>;
  /** A hue for the outline, when it should match a thing the prose names. Left out, it is drawn in ink. */
  readonly tone?: ChartTone | undefined;
  /** The room between the members and the outline, in pixels. Defaults to 10. */
  readonly padding?: number | undefined;
  /** False fades the outline out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  /** True keeps the outline and its members at full strength while the rest recede. */
  readonly isActive?: boolean | undefined;
  /** `context` draws the outline gray; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
};

const LABEL_BAND = 18;
const LABEL_INSET = 8;
const CHARACTER_WIDTH = 7;
const LABEL_BASELINE = 13;
const CORNER = 6;

const styles = stylex.create({
  outline: (color: string, opacity: number) => ({
    fill: `color-mix(in srgb, ${color} 6%, transparent)`,
    stroke: color,
    strokeWidth: 1,
    opacity,
    vectorEffect: 'non-scaling-stroke',
    outlineStyle: 'none',
  }),
  inspected: { strokeWidth: 2 },
  cursor: { fill: 'none', pointerEvents: 'none' },
  fade: (opacity: number) => ({ opacity }),
});

/**
 * A labelled outline around a set of scene objects, such as a layer of a network. It follows its members as they move
 * and resize. Give it a label to make it an item; focusing the camera on its id frames its members.
 */
export function SceneGroup({
  id,
  label,
  text,
  around,
  tone,
  padding = 10,
  isShown = true,
  isActive = false,
  emphasis,
}: SceneGroupProps): ReactNode {
  const members = useSceneFrames(around);
  const scopedTone = useScopedTone(id);
  const name = text ?? label;
  const nameBand = name === undefined ? 0 : LABEL_BAND;

  const object = useSceneObject({
    id,
    kind: 'group',
    values: {},
    label,
    attaches: around,
    surround: { top: padding + nameBand, right: padding, bottom: padding, left: padding },
    isShown,
    isActive,
    emphasis,
  });

  if (!object.scene.isInScene) {
    return <SceneOutside part="SceneGroup" />;
  }

  const rects = members.flatMap((member) =>
    member?.rect === undefined || member.values.opacity <= 0 ? [] : [member.rect],
  );

  const bounds = unionRect(rects);

  if (bounds === undefined || object.values.opacity <= 0) {
    return null;
  }

  const padded = padRect(bounds, padding);
  const top = name === undefined ? padded.top : padded.top - LABEL_BAND;
  const resolved = tone ?? scopedTone ?? 'neutral';
  const color = object.emphasis === 'context' ? sceneContextColor : chartToneColors[resolved];
  const width = Math.max(padded.right - padded.left, (name?.length ?? 0) * CHARACTER_WIDTH + LABEL_INSET * 2);
  const centered = Math.min(padded.left, (padded.left + padded.right - width) / 2);
  const left = padded.left < LABEL_INSET ? centered : Math.max(LABEL_INSET, centered);
  const height = padded.bottom - top;

  const shape = <rect x={left} y={top} width={width} height={height} rx={CORNER} ry={CORNER} />;

  return (
    <SceneLayer layer="back">
      <g {...stylex.props(styles.fade(object.strength))}>
        <ChartMark
          value={id}
          render={shape}
          {...stylex.props(styles.outline(color, object.values.opacity), object.isInspected && styles.inspected)}
        />
        {name !== undefined && (
          <g {...stylex.props(styles.fade(object.values.opacity))}>
            <LabelMark x={left + LABEL_INSET} y={top + LABEL_BASELINE} isStrong>
              {name}
            </LabelMark>
          </g>
        )}
        {object.isCursor && (
          <rect
            x={left}
            y={top}
            width={width}
            height={height}
            rx={CORNER}
            ry={CORNER}
            {...stylex.props(chartStyles.shapeCursor, styles.cursor)}
          />
        )}
      </g>
    </SceneLayer>
  );
}
