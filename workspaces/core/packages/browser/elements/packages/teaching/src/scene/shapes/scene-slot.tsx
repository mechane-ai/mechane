import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../../charts/src/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { ChartMark } from '../../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import { colors, radii, spacing, typography } from '../../../../foundations/src/tokens.stylex.ts';
import { useSceneObject } from '../scene-context.ts';
import type { ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { sceneOutlines } from '../scene-style.ts';
import { sceneCardSizes } from './stack-layout.ts';
import type { SceneCardSizeName } from './stack-layout.ts';

export type SceneSlotProps = {
  /** Stable across states. Wires, brackets and callouts can name the slot. */
  readonly id: string;
  /** The slot's center in data units. */
  readonly at: ScenePosition;
  /**
   * A named card size, with room around it for one card, or an exact pixel box for a row or a pile. Defaults to
   * `medium`.
   */
  readonly size?: SceneCardSizeName | { readonly width: number; readonly height: number } | undefined;
  /** The caption drawn above the top edge, such as "Bay A". The scene makes room for it. */
  readonly text?: string | undefined;
  /** The readout sentence. With one, the arrow keys reach the slot; Left and Right step on to a card sitting on it. */
  readonly label?: string | undefined;
  /** True draws the slot as the place that matters now: a solid outline and a tint. */
  readonly isActive?: boolean | undefined;
  /** The hue of the outline while active. Defaults to neutral. */
  readonly tone?: ChartTone | undefined;
  /** `context` keeps the slot plain; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** False fades the slot out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
};

/** A slot draws under whatever sits on it. */
const SLOT_ORDER = -1;

const SLOT_ROOM = 16;
/** The height of the caption line above the slot and its gap, in pixels. */
const CAPTION_ROOM = 20;

function roomFor(size: SceneCardSizeName): { readonly width: number; readonly height: number } {
  const card = sceneCardSizes[size];

  return { width: card.width + SLOT_ROOM, height: card.height + SLOT_ROOM };
}

const styles = stylex.create({
  slot: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: SLOT_ORDER,
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.faint,
    borderRadius: radii.md,
    outlineStyle: 'none',
  },
  place: (transform: string, opacity: number) => ({ transform, opacity }),
  box: (width: number, height: number) => ({ width, height }),
  active: (color: string) => ({
    borderStyle: 'solid',
    borderColor: color,
    backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
  }),
  gone: { visibility: 'hidden', pointerEvents: 'none' },
  caption: {
    position: 'absolute',
    insetInline: 0,
    bottom: '100%',
    paddingBlockEnd: spacing.xxs,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
});

/**
 * A labelled, outlined place where cards or other nodes go: a bay. Cards are not held by it; give them its position, or
 * list them in a stack anchored at the same point. Name it in a wire or a callout, and set `isActive` for the bay in
 * play.
 */
export function SceneSlot({
  id,
  at,
  size = 'medium',
  text,
  label,
  isActive = false,
  tone = 'neutral',
  emphasis,
  isShown = true,
}: SceneSlotProps): ReactNode {
  const pixels = typeof size === 'string' ? roomFor(size) : size;

  const object = useSceneObject({
    id,
    kind: 'slot',
    frame: {
      x: at[0],
      y: at[1],
      width: pixels.width,
      height: pixels.height,
      outset: text === undefined ? undefined : { top: CAPTION_ROOM },
    },
    values: {},
    label,
    isShown,
    isActive,
    emphasis,
    order: SLOT_ORDER,
  });

  if (!object.scene.isInScene) {
    return <SceneOutside part="SceneSlot" />;
  }

  const { rect = { left: 0, top: 0, right: 0, bottom: 0 }, values } = object;
  const color = chartToneColors[tone];
  const opacity = Math.max(0, Math.min(1, values.opacity)) * object.strength;

  return (
    <ChartMark
      value={id}
      render={<div data-scene-slot={id} />}
      {...stylex.props(
        styles.slot,
        styles.place(`translate(${rect.left}px, ${rect.top}px)`, opacity),
        styles.box(values.width, values.height),
        isActive && styles.active(color),
        !object.isVisible && styles.gone,
        ...sceneOutlines(object),
      )}
    >
      {text !== undefined && (
        <span aria-hidden {...stylex.props(styles.caption)}>
          {text}
        </span>
      )}
    </ChartMark>
  );
}
