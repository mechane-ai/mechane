import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors, formatValue } from '../../../charts/src/index.ts';
import type { ChartTone } from '../../../charts/src/index.ts';
import {
  ChartMark,
  chartStyles,
  labelBox,
  LabelMark,
  linePath,
  LinkMark,
  linkPath,
} from '../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../charts/src/plot/index.ts';
import { useSceneContext, useSceneFrames, useSceneObject } from './scene-context.ts';
import { edgePoint, rectCenter, sidePoint } from './scene-geometry.ts';
import type { ScenePixel } from './scene-geometry.ts';
import { SceneLayer, SceneOutside } from './scene-layer.tsx';
import { sceneContextColor } from './scene-style.ts';
import { fillLabel } from './scene-validate.ts';

/** How a wire runs: straight between edges, or a curve or elbow leaving the sides that face each other. */
export type SceneWireShape = 'straight' | 'curve' | 'elbow';

/**
 * The side of the wire its text sits on. `auto` puts it above a wire that runs across and right of one that runs up or
 * down. A side along the wire, such as `left` of a level wire, falls back to `auto`.
 */
export type SceneWireTextSide = 'auto' | 'top' | 'right' | 'bottom' | 'left';

export type SceneWireProps = {
  /** The id of the object the wire leaves. */
  readonly from: string;
  /** The id of the object the wire reaches. */
  readonly to: string;
  /** Defaults to `from>to`. */
  readonly id?: string | undefined;
  /** The readout sentence. With one, the arrow keys reach the wire. */
  readonly label?: string | undefined;
  /** Short text drawn beside the wire's middle, never on its stroke, such as its weight. */
  readonly text?: string | undefined;
  /** The side of the wire the text sits on. Defaults to `auto`. */
  readonly textSide?: SceneWireTextSide | undefined;
  /** A signed weight: thickness shows its size and, without a tone, hue its sign. */
  readonly weight?: number | undefined;
  /** The hue that names the connection. Left out, the weight's sign or neutral ink. */
  readonly tone?: ChartTone | undefined;
  /** How the wire runs between its ends. Defaults to `straight`. */
  readonly shape?: SceneWireShape | undefined;
  /**
   * Pixels the wire's middle bows off the line between its ends. Positive is above a wire that runs across and right of
   * an upright one. A wire does not avoid other objects, so bow it around a node between its ends.
   */
  readonly bend?: number | undefined;
  /** Dashed for a modelled or proposed connection. */
  readonly isDashed?: boolean | undefined;
  /** Draws an arrowhead at the `to` end. Defaults to true. */
  readonly hasArrow?: boolean | undefined;
  /** False fades the wire out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  /** True keeps the wire and its ends at full strength while the rest recede. */
  readonly isActive?: boolean | undefined;
  /** `context` draws the wire gray; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
};

const WIDTH_MIN = 1.25;
const WIDTH_MAX = 6;
const ARROW_LENGTH = 7;
const ARROW_HALF = 3.5;
/** The shortest stroke that still reads as a wire between two objects, in pixels. */
const STROKE_MIN = 16;
/** The pixels a wire's text keeps from the objects at either end, past its estimated width. */
const TEXT_END_GAP = 4;
const TEXT_OFFSET = 7;
/** How far along a straight wire its text sits: before the middle, where wires into one node are still apart. */
const TEXT_ALONG = 0.4;
const HALF = 0.5;
const SIDES = 2;
const HIT_WIDTH = 12;
/** A side whose direction leans this far off the wire's normal still counts as that side. */
const SIDE_LEAN = 0.38;
/** The estimated rise of the label text above its baseline and its drop below, in pixels. */
const TEXT_ASCENT = 11;
const TEXT_DESCENT = 3;

const sideDirections = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const;

const styles = stylex.create({
  fade: (opacity: number) => ({ opacity }),
  arrow: (color: string, opacity: number) => ({ fill: color, stroke: 'none', opacity, pointerEvents: 'none' }),
  hit: { fill: 'none', stroke: 'transparent', strokeWidth: HIT_WIDTH, pointerEvents: 'stroke', outlineStyle: 'none' },
  cursor: { fill: 'none', pointerEvents: 'none' },
});

function unit(from: ScenePixel, to: ScenePixel): ScenePixel {
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  return length === 0 ? { x: 1, y: 0 } : { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/**
 * The unit normal of a wire running along `direction` that points to `side`. For `auto`, or a side along the wire, it
 * takes the side above a wire that runs across. For a wire that runs up or down it takes the right.
 */
function textNormal(direction: ScenePixel, side: SceneWireTextSide): ScenePixel {
  const normal = { x: -direction.y, y: direction.x };
  const isAcross = Math.abs(direction.x) >= Math.abs(direction.y);
  const fallback = isAcross ? sideDirections.top : sideDirections.right;
  const wanted = side === 'auto' ? fallback : sideDirections[side];
  const lean = normal.x * wanted.x + normal.y * wanted.y;
  const isAlong = Math.abs(lean) < SIDE_LEAN;
  const chosen = isAlong ? normal.x * fallback.x + normal.y * fallback.y : lean;

  return chosen < 0 ? { x: -normal.x, y: -normal.y } : normal;
}

/** Where text beside a point sits so that it grows away from the wire along `normal`: its anchor and baseline. */
function textSpot(
  point: ScenePixel,
  normal: ScenePixel,
): { readonly x: number; readonly y: number; readonly anchor: 'start' | 'middle' | 'end' } {
  const anchorOf = normal.x > SIDE_LEAN ? 'start' : 'middle';
  const anchor = normal.x < -SIDE_LEAN ? 'end' : anchorOf;
  const level = point.y + (TEXT_ASCENT - TEXT_DESCENT) * HALF;
  const below = normal.y > SIDE_LEAN ? point.y + TEXT_ASCENT : level;

  return { x: point.x, y: normal.y < -SIDE_LEAN ? point.y - TEXT_DESCENT : below, anchor };
}

/**
 * The pixels a wire keeps between its ends: a stroke long enough to read as a wire, or to hold its text beside it, and
 * its arrow. Text sits before the middle, so the stroke is long enough that the text clears both ends by a gap.
 */
function wireRoom(text: string | undefined, hasArrow: boolean): number {
  const arrow = hasArrow ? ARROW_LENGTH : 0;

  if (text === undefined) {
    return STROKE_MIN + arrow;
  }

  const box = labelBox({ x: 0, y: 0, anchor: 'start', text });
  const width = box.right - box.left + SIDES * TEXT_END_GAP;
  const reach = Math.ceil(width / (SIDES * Math.min(TEXT_ALONG, 1 - TEXT_ALONG)));

  return Math.max(STROKE_MIN, reach) + arrow;
}

function defaultTone(weight: number | undefined): ChartTone {
  if (weight === undefined || weight === 0) {
    return 'neutral';
  }

  return weight > 0 ? 'positive' : 'negative';
}

/**
 * A connection between two scene objects that stays attached to their edges while they move. Its thickness can carry a
 * signed weight, eased when the weight changes. Give it a label to make it an item the reader can inspect.
 */
export function SceneWire({
  from,
  to,
  id = `${from}>${to}`,
  label,
  text,
  textSide = 'auto',
  weight,
  tone,
  shape = 'straight',
  bend = 0,
  isDashed = false,
  hasArrow = true,
  isShown = true,
  isActive = false,
  emphasis,
}: SceneWireProps): ReactNode {
  const ends = useSceneFrames([from, to]);
  const source = ends[0];
  const target = ends[1];
  const scene = useSceneContext();
  const isOverweight = weight !== undefined && Math.abs(weight) > scene.weightMax;

  const problem = isOverweight
    ? fillLabel(scene.labels.weightOutside, {
        id,
        weight: formatValue({ value: weight, locale: scene.locale, format: { maximumFractionDigits: 3 } }),
        limit: String(scene.weightMax),
      })
    : undefined;

  const object = useSceneObject({
    id,
    kind: 'wire',
    values: { weight: weight ?? 0, bend: shape === 'straight' ? bend : 0 },
    label,
    attaches: [from, to],
    room: wireRoom(text, hasArrow),
    isShown,
    isActive,
    emphasis,
    problem,
  });

  if (!scene.isInScene) {
    return <SceneOutside part="SceneWire" />;
  }

  if (source === undefined || target === undefined) {
    return null;
  }

  const sourceRect = source.rect;
  const targetRect = target.rect;

  if (sourceRect === undefined || targetRect === undefined) {
    return null;
  }

  const opacity = object.values.opacity * Math.min(source.values.opacity, target.values.opacity);

  if (opacity <= 0) {
    return null;
  }

  const sourceCenter = rectCenter(sourceRect);
  const targetCenter = rectCenter(targetRect);
  const isAcross = Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y);
  const axis = isAcross ? 'x' : 'y';
  const delta = axis === 'x' ? targetCenter.x - sourceCenter.x : targetCenter.y - sourceCenter.y;
  const sign = delta < 0 ? -1 : 1;
  const isStraight = shape === 'straight';
  const bow = textNormal(unit(sourceCenter, targetCenter), 'auto');
  const bowed = object.values.bend * SIDES;
  const middle = { x: (sourceCenter.x + targetCenter.x) * HALF, y: (sourceCenter.y + targetCenter.y) * HALF };
  const control = { x: middle.x + bow.x * bowed, y: middle.y + bow.y * bowed };
  const isBowed = isStraight && object.values.bend !== 0;

  const start = isStraight
    ? edgePoint({ rect: sourceRect, shape: source.member.shape, toward: isBowed ? control : targetCenter })
    : sidePoint({ rect: sourceRect, axis, sign });

  const end = isStraight
    ? edgePoint({ rect: targetRect, shape: target.member.shape, toward: isBowed ? control : sourceCenter })
    : sidePoint({ rect: targetRect, axis, sign: -sign });

  const axisDirection = axis === 'x' ? { x: sign, y: 0 } : { x: 0, y: sign };
  const direction = isStraight ? unit(start, end) : axisDirection;
  const arriving = isBowed ? unit(control, end) : direction;
  const stop = hasArrow ? { x: end.x - arriving.x * ARROW_LENGTH, y: end.y - arriving.y * ARROW_LENGTH } : end;

  const bowedPath = `M${start.x},${start.y}Q${control.x},${control.y} ${stop.x},${stop.y}`;
  const straightPath = isBowed ? bowedPath : linePath([start, stop]);

  const path = isStraight ? straightPath : linkPath({ x1: start.x, y1: start.y, x2: stop.x, y2: stop.y, axis, shape });

  const resolved = tone ?? defaultTone(weight);
  const color = object.emphasis === 'context' ? sceneContextColor : chartToneColors[resolved];
  const magnitude = Math.min(1, Math.abs(object.values.weight) / scene.weightMax);
  const width = weight === undefined ? WIDTH_MIN : WIDTH_MIN + magnitude * (WIDTH_MAX - WIDTH_MIN);
  const along = isStraight ? TEXT_ALONG : HALF;
  const onChord = { x: start.x + (stop.x - start.x) * along, y: start.y + (stop.y - start.y) * along };
  const lift = isBowed ? SIDES * along * (1 - along) * bowed : 0;
  const anchor = { x: onChord.x + bow.x * lift, y: onChord.y + bow.y * lift };
  const normal = { x: -arriving.y, y: arriving.x };
  const side = textNormal(direction, textSide);
  const spot = textSpot({ x: anchor.x + side.x * TEXT_OFFSET, y: anchor.y + side.y * TEXT_OFFSET }, side);

  const arrow = [
    `M${end.x},${end.y}`,
    `L${stop.x + normal.x * ARROW_HALF},${stop.y + normal.y * ARROW_HALF}`,
    `L${stop.x - normal.x * ARROW_HALF},${stop.y - normal.y * ARROW_HALF}Z`,
  ].join('');

  return (
    <SceneLayer layer="wires">
      <g data-scene-wire={id} {...stylex.props(styles.fade(opacity))}>
        <LinkMark
          d={path}
          tone={resolved}
          width={object.isInspected ? width + 1 : width}
          stroke={isDashed ? 'dashed' : 'solid'}
          emphasis={object.emphasis}
        />
        {hasArrow && <path d={arrow} {...stylex.props(styles.arrow(color, object.strength))} />}
        {text !== undefined && (
          <LabelMark x={spot.x} y={spot.y} anchor={spot.anchor}>
            {text}
          </LabelMark>
        )}
        {label !== undefined && isShown && (
          <ChartMark value={id} render={<path d={path} />} {...stylex.props(styles.hit)} />
        )}
        {object.isCursor && <path d={path} {...stylex.props(chartStyles.shapeCursor, styles.cursor)} />}
      </g>
    </SceneLayer>
  );
}
