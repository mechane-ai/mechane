import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { ChartMark, LabelMark, RuleMark } from '../../../charts/src/plot/index.ts';
import { useSceneFrames, useSceneObject } from './scene-context.ts';
import { unionRect } from './scene-geometry.ts';
import type { SceneRect } from './scene-geometry.ts';
import { SceneLayer, SceneOutside } from './scene-layer.tsx';

/** The side of its members a bracket runs along. */
export type SceneBracketSide = 'top' | 'right' | 'bottom' | 'left';

export type SceneBracketProps = {
  /** The ids the bracket spans. It follows them as they move. */
  readonly of: ReadonlyArray<string>;
  /** Defaults to `bracket:` and the first id. */
  readonly id?: string | undefined;
  /** The readout sentence and, unless `text` is set, the words drawn beside the bracket. */
  readonly label?: string | undefined;
  /** Shorter words to draw, when the label is a full sentence. */
  readonly text?: string | undefined;
  /** Defaults to `bottom`. A bracket with no room on its side moves to the opposite one. */
  readonly side?: SceneBracketSide | undefined;
  /** The room between the members and the bracket, in pixels. Defaults to 8. */
  readonly padding?: number | undefined;
  /** False fades the bracket out. */
  readonly isShown?: boolean | undefined;
};

const TICK = 6;
const LABEL_GAP = 14;
const LABEL_SIDE_GAP = 6;
const CHARACTER_WIDTH = 6.5;
const EDGE = 4;

const verticalSides: ReadonlySet<SceneBracketSide> = new Set(['top', 'bottom']);

const opposite: Readonly<Record<SceneBracketSide, SceneBracketSide>> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const styles = stylex.create({
  fade: (opacity: number) => ({ opacity }),
  hit: { fill: 'transparent', stroke: 'none', outlineStyle: 'none' },
});

type Bracket = {
  readonly lines: ReadonlyArray<{
    readonly key: string;
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
  }>;
  readonly label: { readonly x: number; readonly y: number; readonly anchor: 'start' | 'middle' | 'end' };
  readonly hit: SceneRect;
};

function bracketOn({
  bounds,
  side,
  padding,
  textWidth,
  stage,
}: {
  readonly bounds: SceneRect;
  readonly side: SceneBracketSide;
  readonly padding: number;
  readonly textWidth: number;
  readonly stage: { readonly width: number; readonly height: number };
}): Bracket {
  const middleX = Math.min(
    stage.width - textWidth / 2 - EDGE,
    Math.max(textWidth / 2 + EDGE, (bounds.left + bounds.right) / 2),
  );

  const middleY = (bounds.top + bounds.bottom) / 2;

  if (verticalSides.has(side)) {
    const sign = side === 'bottom' ? 1 : -1;
    const at = side === 'bottom' ? bounds.bottom + padding : bounds.top - padding;

    return {
      lines: [
        { key: 'span', x1: bounds.left, y1: at, x2: bounds.right, y2: at },
        { key: 'start', x1: bounds.left, y1: at, x2: bounds.left, y2: at - sign * TICK },
        { key: 'end', x1: bounds.right, y1: at, x2: bounds.right, y2: at - sign * TICK },
      ],
      label: { x: middleX, y: side === 'bottom' ? at + LABEL_GAP : at - LABEL_SIDE_GAP, anchor: 'middle' },
      hit: { left: bounds.left, top: at - TICK, right: bounds.right, bottom: at + TICK },
    };
  }

  const sign = side === 'right' ? 1 : -1;
  const at = side === 'right' ? bounds.right + padding : bounds.left - padding;

  return {
    lines: [
      { key: 'span', x1: at, y1: bounds.top, x2: at, y2: bounds.bottom },
      { key: 'start', x1: at, y1: bounds.top, x2: at - sign * TICK, y2: bounds.top },
      { key: 'end', x1: at, y1: bounds.bottom, x2: at - sign * TICK, y2: bounds.bottom },
    ],
    label: { x: at + sign * LABEL_SIDE_GAP, y: middleY + EDGE, anchor: side === 'right' ? 'start' : 'end' },
    hit: { left: at - TICK, top: bounds.top, right: at + TICK, bottom: bounds.bottom },
  };
}

function fitsOn({
  bounds,
  side,
  room,
  stage,
}: {
  readonly bounds: SceneRect;
  readonly side: SceneBracketSide;
  readonly room: number;
  readonly stage: { readonly width: number; readonly height: number };
}): boolean {
  const space: Readonly<Record<SceneBracketSide, number>> = {
    top: bounds.top,
    bottom: stage.height - bounds.bottom,
    left: bounds.left,
    right: stage.width - bounds.right,
  };

  return space[side] >= room;
}

/**
 * A bracket along one side of a set of scene objects, with words beside it: "the hidden layer", "three inputs". It
 * follows its members as they move. Use a group for an outline around them instead.
 */
export function SceneBracket({
  of,
  id = `bracket:${of[0] ?? ''}`,
  label,
  text,
  side = 'bottom',
  padding = 8,
  isShown = true,
}: SceneBracketProps): ReactNode {
  const members = useSceneFrames(of);
  const object = useSceneObject({ id, kind: 'bracket', values: {}, label, attaches: of, isShown });
  const { scene } = object;

  if (!scene.isInScene) {
    return <SceneOutside part="SceneBracket" />;
  }

  const bounds = unionRect(members.flatMap((member) => (member?.rect === undefined ? [] : [member.rect])));
  const words = text ?? label;
  const textWidth = (words?.length ?? 0) * CHARACTER_WIDTH;

  if (bounds === undefined || object.values.opacity <= 0) {
    return null;
  }

  const stage = { width: scene.box.width, height: scene.box.height };
  const isVertical = verticalSides.has(side);
  const room = padding + (isVertical ? LABEL_GAP + EDGE : textWidth + LABEL_SIDE_GAP + EDGE);
  const placed = fitsOn({ bounds, side, room, stage }) ? side : opposite[side];
  const bracket = bracketOn({ bounds, side: placed, padding, textWidth, stage });
  const { hit } = bracket;

  return (
    <SceneLayer layer="front">
      <g {...stylex.props(styles.fade(object.values.opacity))}>
        {bracket.lines.map((line) => (
          <RuleMark key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
        ))}
        {words !== undefined && (
          <LabelMark x={bracket.label.x} y={bracket.label.y} anchor={bracket.label.anchor}>
            {words}
          </LabelMark>
        )}
        {label !== undefined && isShown && (
          <ChartMark
            value={id}
            render={<rect x={hit.left} y={hit.top} width={hit.right - hit.left} height={hit.bottom - hit.top} />}
            {...stylex.props(styles.hit)}
          />
        )}
      </g>
    </SceneLayer>
  );
}
