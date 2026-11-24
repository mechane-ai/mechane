import * as stylex from '@stylexjs/stylex';
import { memo } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { chartToneColors, useScopedTone } from '../../../charts/src/index.ts';
import type { ChartTone } from '../../../charts/src/index.ts';
import { ChartMark } from '../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../charts/src/plot/index.ts';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { Pace } from '../time/tween.ts';
import { useSceneObject } from './scene-context.ts';
import { nodeBox } from './scene-geometry.ts';
import type { SceneOffset, ScenePosition, SceneShape, SceneSize } from './scene-geometry.ts';
import { SceneOutside } from './scene-layer.tsx';
import type { SceneDelay, SceneStaggerPlace } from './scene-stagger.ts';
import { sceneContextColor, sceneOutlines } from './scene-style.ts';

export type SceneNodeProps = {
  /** Stable across states: the node with this id eases to its new props. */
  readonly id: string;
  /** The node's center, in the scene's data units. */
  readonly at: ScenePosition;
  /** A shift from `at` in pixels, across then down, for a node placed beside another rather than in data units. */
  readonly offset?: SceneOffset | undefined;
  /** The full sentence for the readout and assistive technology. With one, the arrow keys reach the node. */
  readonly label?: string | undefined;
  /** What the node shows. Cut with an ellipsis when it does not fit; the label keeps the full text. */
  readonly text?: string | undefined;
  /** True for token text, code or an id: drawn in monospace. Names use the body face. */
  readonly isCode?: boolean | undefined;
  /** A named size or a pixel box. Defaults to `medium`. */
  readonly size?: SceneSize | undefined;
  /** The outline: `box`, `pill`, `circle` or `plain` text. Defaults to `box`; wires meet it at its edge. */
  readonly shape?: SceneShape | undefined;
  /** The hue that names the thing. Left out, the tone scope's tone for the id, or neutral. */
  readonly tone?: ChartTone | undefined;
  /** `context` draws the node gray; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** False fades the node out and takes it out of the keyboard order. Its content keeps its state. */
  readonly isShown?: boolean | undefined;
  /** True keeps the node at full strength while the parts it is not connected to recede. */
  readonly isActive?: boolean | undefined;
  /** 0 shows the front, 1 the back; values between are mid-flip. */
  readonly turn?: number | undefined;
  /** 0 rests on the page, 1 is raised toward the reader: larger, with a deeper shadow. */
  readonly lift?: number | undefined;
  /** Degrees of tilt around the horizontal axis; positive leans the top away. */
  readonly tilt?: number | undefined;
  /** Degrees of turn in the page around the node's center; positive turns clockwise, as one card of a fan. */
  readonly rotate?: number | undefined;
  /** The stacking order: higher draws above. A lifted node draws above every resting one. Defaults to 0. */
  readonly order?: number | undefined;
  /** How long every change waits before the node moves. Defaults to 0. */
  readonly delay?: SceneDelay | undefined;
  /**
   * The node's place in a stagger group. Nodes of one group that change in the same update start one step apart in
   * `index` order, and a node that changes alone starts at once.
   */
  readonly stagger?: SceneStaggerPlace | undefined;
  /** Overrides the scene's pace for this node. */
  readonly pace?: Pace | undefined;
  /**
   * True draws the node without making room for it: the scene's margins and derived minimum width leave it out. Use it
   * for a node another part makes room for, as a stack does for its cards.
   */
  readonly isFloating?: boolean | undefined;
  /** The other face, shown as the node turns. */
  readonly back?: ReactNode;
  /** The hue of the back face. Left out, the node's own; a playing card passes neutral so its back hides the suit. */
  readonly backTone?: ChartTone | undefined;
  /** Rich content under the text, such as a compact chart. It keeps its state while the node moves or resizes. */
  readonly children?: ReactNode;
};

const HALF_TURN = 180;
const LIFT_DEPTH = 48;
const LIFT_SCALE = 0.08;
const LIFTED_ORDER = 1000;
const PERSPECTIVE = 900;
const PILL_RADIUS = 999;
const BORDER_WIDTH = 1.5;
const SHADOW_DROP = { rest: 2, lifted: 14 } as const;
const SHADOW_BLUR = { rest: 4, lifted: 22 } as const;
const SHADOW_STRENGTH = 22;

const styles = stylex.create({
  node: (transform: string, width: number, height: number) => ({
    position: 'absolute',
    left: 0,
    top: 0,
    width,
    height,
    transform,
    pointerEvents: 'auto',
  }),
  order: (zIndex: number) => ({ zIndex }),
  fade: (opacity: number) => ({ opacity }),
  deep: { perspective: PERSPECTIVE },
  gone: { visibility: 'hidden', pointerEvents: 'none' },
  card: (transform: string) => ({
    position: 'absolute',
    inset: 0,
    display: 'block',
    transform,
    transformStyle: 'preserve-3d',
    outlineStyle: 'none',
  }),
  shadow: (boxShadow: string, transform: string) => ({
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    boxShadow,
    transform,
  }),
  face: (color: string) => ({
    position: 'absolute',
    inset: 0,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingBlock: spacing.xxs,
    paddingInline: spacing.xs,
    overflow: 'hidden',
    borderWidth: BORDER_WIDTH,
    borderStyle: 'solid',
    borderColor: color,
    backgroundColor: `color-mix(in srgb, ${color} 10%, ${colors.surface})`,
    color: colors.ink,
    backfaceVisibility: 'hidden',
  }),
  rich: { justifyContent: 'flex-start' },
  backFace: { transform: `rotateY(${HALF_TURN}deg)` },
  text: {
    display: '-webkit-box',
    flexShrink: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    textAlign: 'center',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflowWrap: 'anywhere',
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.mediumWeight,
    fontVariantNumeric: 'tabular-nums',
  },
  code: { fontFamily: typography.monoFamily, fontWeight: typography.regularWeight },
  content: { alignSelf: 'stretch', flexGrow: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' },
});

const shapes = stylex.create({
  box: { borderRadius: radii.md },
  pill: { borderRadius: PILL_RADIUS },
  circle: { borderRadius: '50%' },
  plain: { borderColor: 'transparent', backgroundColor: 'transparent' },
});

const radiusOnly = stylex.create({
  box: { borderRadius: radii.md },
  pill: { borderRadius: PILL_RADIUS },
  circle: { borderRadius: '50%' },
  plain: { borderRadius: radii.md },
});

/**
 * A labelled box, pill or circle at a position in the scene, with optional rich content and a back face. Change its
 * props and it eases there: it moves, resizes, turns, lifts, tilts and rotates. Wires attach to its edge.
 */
export function SceneNode({
  id,
  at,
  offset,
  label,
  text,
  isCode = false,
  size = 'medium',
  shape = 'box',
  tone,
  emphasis,
  isShown = true,
  isActive = false,
  turn = 0,
  lift = 0,
  tilt = 0,
  rotate = 0,
  order = 0,
  delay,
  stagger,
  pace,
  isFloating,
  back,
  backTone,
  children,
}: SceneNodeProps): ReactNode {
  const scopedTone = useScopedTone(id);
  const pixels = nodeBox(size, shape);

  const object = useSceneObject({
    id,
    kind: 'node',
    frame: { x: at[0], y: at[1], width: pixels.width, height: pixels.height, offset },
    values: { turn, lift, tilt, rotate },
    shape,
    label,
    isShown,
    isActive,
    emphasis,
    order,
    delay,
    stagger,
    pace,
    isFloating,
  });

  if (!object.scene.isInScene) {
    return <SceneOutside part="SceneNode" />;
  }

  const { values, rect = { left: 0, top: 0, right: 0, bottom: 0 } } = object;
  const resolved = tone ?? scopedTone ?? 'neutral';
  const isContext = object.emphasis === 'context';
  const color = isContext ? sceneContextColor : chartToneColors[resolved];
  const backColor = isContext ? sceneContextColor : chartToneColors[backTone ?? resolved];
  const raised = Math.max(0, values.lift);

  const shadow = [
    `0 ${SHADOW_DROP.rest + raised * SHADOW_DROP.lifted}px`,
    `${SHADOW_BLUR.rest + raised * SHADOW_BLUR.lifted}px`,
    `color-mix(in srgb, ${colors.ink} ${Math.round(raised * SHADOW_STRENGTH)}%, transparent)`,
  ].join(' ');

  const isFlat = raised === 0 && values.tilt === 0 && values.turn === 0;
  const place = `translate(${rect.left}px, ${rect.top}px)`;
  const zIndex = order + (lift > 0 ? LIFTED_ORDER : 0);

  const transform = isFlat
    ? 'none'
    : [
        `translateZ(${raised * LIFT_DEPTH}px)`,
        `rotateX(${values.tilt}deg)`,
        `rotateY(${values.turn * HALF_TURN}deg)`,
        `scale(${1 + raised * LIFT_SCALE})`,
      ].join(' ');

  return (
    <div
      aria-hidden={isShown ? undefined : true}
      inert={!isShown}
      data-scene-node={id}
      {...stylex.props(
        styles.node(values.rotate === 0 ? place : `${place} rotate(${values.rotate}deg)`, values.width, values.height),
        styles.order(zIndex),
        styles.fade(Math.max(0, Math.min(1, values.opacity)) * object.strength),
        !isFlat && styles.deep,
        !object.isVisible && styles.gone,
      )}
    >
      {raised > 0 && (
        <div {...stylex.props(styles.shadow(shadow, `scale(${1 + raised * LIFT_SCALE})`), radiusOnly[shape])} />
      )}
      <NodeCard
        id={id}
        transform={transform}
        color={color}
        backColor={backColor}
        shape={shape}
        isInspected={object.isInspected}
        isSelected={object.isSelected}
        isCursor={object.isCursor}
        text={text}
        isCode={isCode}
        hasBack={back !== undefined || !isFlat}
        back={back}
        focusPlot={object.focusPlot}
      >
        {children}
      </NodeCard>
    </div>
  );
}

type NodeCardProps = {
  readonly id: string;
  readonly transform: string;
  readonly color: string;
  readonly backColor: string;
  readonly shape: SceneShape;
  readonly isInspected: boolean;
  readonly isSelected: boolean;
  readonly isCursor: boolean;
  readonly text: string | undefined;
  readonly isCode: boolean;
  readonly hasBack: boolean;
  readonly back: ReactNode;
  readonly focusPlot: () => void;
  readonly children: ReactNode;
};

/**
 * The faces of a node. It is memoized, so a node that only moves or resizes redraws its outer box and not its faces,
 * its inspection mark or its rich content.
 */
function NodeFaces({
  id,
  transform,
  color,
  backColor,
  shape,
  isInspected,
  isSelected,
  isCursor,
  text,
  isCode,
  hasBack,
  back,
  focusPlot,
  children,
}: NodeCardProps): ReactNode {
  const hasContent = children !== undefined && children !== null;

  function onMouseDown(event: MouseEvent): void {
    if (!hasContent) {
      event.preventDefault();
      focusPlot();
    }
  }

  return (
    <ChartMark
      value={id}
      render={<div />}
      onMouseDown={onMouseDown}
      {...stylex.props(
        styles.card(transform),
        ...sceneOutlines({ isInspected, isSelected, isCursor }),
        radiusOnly[shape],
      )}
    >
      <div {...stylex.props(styles.face(color), shapes[shape], hasContent && styles.rich)}>
        {text !== undefined && (
          <span aria-hidden {...stylex.props(styles.text, isCode && styles.code)}>
            {text}
          </span>
        )}
        {hasContent && <div {...stylex.props(styles.content)}>{children}</div>}
      </div>
      {hasBack && <div {...stylex.props(styles.face(backColor), shapes[shape], styles.backFace)}>{back}</div>}
    </ChartMark>
  );
}

const NodeCard = memo(NodeFaces);
