import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { chartStyles } from '../chart-theme.ts';

/** A solid stroke is an observation. A dashed one is modelled: a fit, a projection, a baseline or a target. */
export type MarkStroke = 'solid' | 'dashed';

/** How much a mark asks for attention: itself, gray context behind the subject, or receded while another is focused. */
export type MarkEmphasis = 'normal' | 'context' | 'receded';

/** What a pointer or the application has done to a mark. */
export type MarkState = { readonly isInspected?: boolean | undefined; readonly isSelected?: boolean | undefined };

const DOT_RADIUS = 4;
const LINK_WIDTH = 1.25;

const styles = stylex.create({
  line: { fill: 'none' },
  area: { fillOpacity: 0.82, stroke: 'none' },
  paleArea: { fillOpacity: 0.12 },
  guide: { stroke: colors.muted, strokeWidth: 1, strokeDasharray: '2 3', vectorEffect: 'non-scaling-stroke' },
  ring: { fill: colors.surface, stroke: colors.ink, strokeWidth: 2, vectorEffect: 'non-scaling-stroke' },
  band: { fillOpacity: 0.16, stroke: 'none' },
  hollow: { fill: colors.surface, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' },
  hollowBar: { strokeDasharray: '3 3' },
  rule: { stroke: colors.ink, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
  interval: { strokeWidth: 2, strokeLinecap: 'butt', vectorEffect: 'non-scaling-stroke' },
  pointerless: { pointerEvents: 'none' },
  link: { fill: 'none', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' },
  linkWidth: (width: number) => ({ strokeWidth: width }),
  toned: (color: string) => ({ fill: color }),
  toneStroke: (color: string) => ({ stroke: color }),
});

const strokes = stylex.create({ solid: {}, dashed: { strokeDasharray: '5 4' } });

/** The emphasis of a line: context thins it, and a receded line fades while another holds the reader's attention. */
const lineEmphasis = stylex.create({ normal: {}, context: { strokeWidth: 1 }, receded: { opacity: 0.32 } });

/** The emphasis of a filled mark. Context changes its color, not its shape. */
const fillEmphasis = stylex.create({ normal: {}, context: {}, receded: { opacity: 0.32 } });

/**
 * The gray of context marks: between the faint and muted text colors. It recedes behind the subject on a light surface
 * and stays visible, above 5:1, on a dark one.
 */
const CONTEXT_COLOR = `color-mix(in srgb, ${colors.faint} 70%, ${colors.muted})`;

function toneColor(tone: ChartTone, emphasis: MarkEmphasis): string {
  return emphasis === 'context' ? CONTEXT_COLOR : chartToneColors[tone];
}

export type LineMarkProps = {
  /** The path from `linePath`. */
  readonly d: string;
  readonly tone: ChartTone;
  readonly stroke?: MarkStroke | undefined;
  readonly emphasis?: MarkEmphasis | undefined;
};

/** A line through ordered observations. Its hue names the series. */
export function LineMark({ d, tone, stroke = 'solid', emphasis = 'normal' }: LineMarkProps): ReactNode {
  return (
    <path
      d={d}
      stroke={toneColor(tone, emphasis)}
      {...stylex.props(chartStyles.mark, chartStyles.emphasis, styles.line, strokes[stroke], lineEmphasis[emphasis])}
    />
  );
}

export type AreaMarkProps = Omit<LineMarkProps, 'stroke'> & {
  /** True for areas drawn over one another, not stacked. A pale fill under the series line keeps each visible. */
  readonly isPale?: boolean | undefined;
};

/** A filled amount, such as a stacked area or a density. Its height carries the value. */
export function AreaMark({ d, tone, emphasis = 'normal', isPale = false }: AreaMarkProps): ReactNode {
  return (
    <path
      d={d}
      fill={toneColor(tone, emphasis)}
      {...stylex.props(styles.area, isPale && styles.paleArea, chartStyles.emphasis, fillEmphasis[emphasis])}
    />
  );
}

/** A pale band of uncertainty around a line: an interval, a spread across seeds or a range of runs. */
export function BandMark({ d, tone, emphasis = 'normal' }: Omit<LineMarkProps, 'stroke'>): ReactNode {
  return (
    <path
      d={d}
      fill={toneColor(tone, emphasis)}
      {...stylex.props(styles.band, chartStyles.emphasis, fillEmphasis[emphasis])}
    />
  );
}

export type DotMarkProps = MarkState & {
  readonly x: number;
  readonly y: number;
  readonly tone: ChartTone;
  readonly radius?: number | undefined;
  /** True for a value that is missing, masked or excluded: an outline with no fill. */
  readonly isHollow?: boolean | undefined;
  readonly emphasis?: MarkEmphasis | undefined;
  /** The record's id, written as `data-chart-mark` so a figure outside the chart can find this mark. */
  readonly mark?: string | undefined;
};

/** One observation at a position. */
export function DotMark({
  x,
  y,
  tone,
  radius = DOT_RADIUS,
  isHollow = false,
  emphasis = 'normal',
  isInspected = false,
  isSelected = false,
  mark,
}: DotMarkProps): ReactNode {
  const color = toneColor(tone, emphasis);

  return (
    <circle
      data-chart-mark={mark}
      cx={x}
      cy={y}
      r={radius}
      fill={color}
      stroke={isHollow ? color : chartToneOutlines[tone]}
      {...stylex.props(
        chartStyles.outlined,
        chartStyles.emphasis,
        isHollow && styles.hollow,
        fillEmphasis[emphasis],
        isInspected && chartStyles.inspected,
        isSelected && chartStyles.selected,
      )}
    />
  );
}

export type BarMarkProps = MarkState & {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tone: ChartTone;
  readonly isHollow?: boolean | undefined;
  readonly emphasis?: MarkEmphasis | undefined;
  /** The record's id, written as `data-chart-mark` so a figure outside the chart can find this mark. */
  readonly mark?: string | undefined;
};

/** A rectangle whose length carries an amount from a zero baseline, or whose area fills a cell. */
export function BarMark({
  x,
  y,
  width,
  height,
  tone,
  isHollow = false,
  emphasis = 'normal',
  isInspected = false,
  isSelected = false,
  mark,
}: BarMarkProps): ReactNode {
  const color = toneColor(tone, emphasis);

  return (
    <rect
      data-chart-mark={mark}
      x={x}
      y={y}
      width={Math.max(0, width)}
      height={Math.max(0, height)}
      fill={color}
      stroke={isHollow ? color : chartToneOutlines[tone]}
      {...stylex.props(
        chartStyles.outlined,
        chartStyles.emphasis,
        isHollow && styles.hollow,
        isHollow && styles.hollowBar,
        fillEmphasis[emphasis],
        isInspected && chartStyles.inspected,
        isSelected && chartStyles.selected,
      )}
    />
  );
}

/** The outline of a symbol: a shape names a kind of record, so it never relies on hue alone. */
export type SymbolShape = 'circle' | 'square' | 'diamond';

const DIAMOND_SCALE = 1.3;

function symbolOutline({
  shape,
  x,
  y,
  radius,
}: {
  readonly shape: SymbolShape;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}): string {
  const size = shape === 'diamond' ? radius * DIAMOND_SCALE : radius;

  switch (shape) {
    case 'circle':
      return `M${x - size},${y}a${size},${size} 0 1,0 ${2 * size},0a${size},${size} 0 1,0 ${-2 * size},0Z`;
    case 'square':
      return `M${x - size},${y - size}h${2 * size}v${2 * size}h${-2 * size}Z`;
    case 'diamond':
      return `M${x},${y - size}L${x + size},${y}L${x},${y + size}L${x - size},${y}Z`;
  }
}

export type SymbolMarkProps = DotMarkProps & { readonly shape: SymbolShape };

/**
 * One record drawn as a circle, a square or a diamond, such as a node whose kind the shape names. A hollow symbol is
 * missing, masked or unexplained. Use `DotMark` when every record has the same kind.
 */
export function SymbolMark({
  shape,
  x,
  y,
  tone,
  radius = DOT_RADIUS,
  isHollow = false,
  emphasis = 'normal',
  isInspected = false,
  isSelected = false,
  mark,
}: SymbolMarkProps): ReactNode {
  const color = toneColor(tone, emphasis);

  return (
    <path
      data-chart-mark={mark}
      d={symbolOutline({ shape, x, y, radius })}
      fill={color}
      stroke={isHollow ? color : chartToneOutlines[tone]}
      {...stylex.props(
        chartStyles.outlined,
        chartStyles.emphasis,
        isHollow && styles.hollow,
        fillEmphasis[emphasis],
        isSelected ? chartStyles.selected : isInspected && chartStyles.inspected,
      )}
    />
  );
}

export type LinkMarkProps = {
  /** The path from `linkPath`. */
  readonly d: string;
  readonly tone: ChartTone;
  /** The stroke width in CSS pixels. A width that carries a magnitude, such as an edge weight, needs a legend. */
  readonly width?: number | undefined;
  readonly stroke?: MarkStroke | undefined;
  readonly emphasis?: MarkEmphasis | undefined;
};

/**
 * A link between two marks: an edge of a graph or a branch of a tree. Gray context suits a structure; two hues around
 * neutral suit a signed weight. Draw only links the application supplied: position never implies one.
 */
export function LinkMark({
  d,
  tone,
  width = LINK_WIDTH,
  stroke = 'solid',
  emphasis = 'normal',
}: LinkMarkProps): ReactNode {
  return (
    <path
      d={d}
      stroke={toneColor(tone, emphasis)}
      {...stylex.props(
        styles.link,
        styles.pointerless,
        styles.linkWidth(width),
        strokes[stroke],
        chartStyles.emphasis,
        fillEmphasis[emphasis],
      )}
    />
  );
}

export type Segment = { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };

/**
 * A straight guide in ink: a threshold, a target or a reference value. Dashed when the value is modelled. A tone colors
 * a guide the legend names, such as a budget drawn in the same hue as its legend entry.
 */
export function RuleMark({
  x1,
  y1,
  x2,
  y2,
  stroke = 'solid',
  tone,
}: Segment & { readonly stroke?: MarkStroke | undefined; readonly tone?: ChartTone | undefined }): ReactNode {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      {...stylex.props(
        styles.rule,
        styles.pointerless,
        strokes[stroke],
        tone !== undefined && styles.toneStroke(chartToneColors[tone]),
      )}
    />
  );
}

/**
 * A faint dotted segment that carries a level from one mark to the next, such as a running total between the columns of
 * a bridge. It claims no value of its own, so it stays lighter than a `RuleMark`.
 */
export function ConnectorMark({ x1, y1, x2, y2 }: Segment): ReactNode {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} {...stylex.props(styles.guide, styles.pointerless)} />;
}

/** A segment in a series' hue: an interval between two bounds, a whisker, or the link between two paired values. */
export function IntervalMark({
  x1,
  y1,
  x2,
  y2,
  tone,
  emphasis = 'normal',
}: Segment & { readonly tone: ChartTone; readonly emphasis?: MarkEmphasis | undefined }): ReactNode {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={toneColor(tone, emphasis)}
      {...stylex.props(styles.interval, chartStyles.emphasis, fillEmphasis[emphasis])}
    />
  );
}

export type LabelMarkProps = {
  readonly x: number;
  readonly y: number;
  readonly anchor?: 'start' | 'middle' | 'end' | undefined;
  /** The series the label names, when it sits at the end of that series' line in place of a legend entry. */
  readonly tone?: ChartTone | undefined;
  /** True for a label that states a total rather than a part, such as the start and end columns of a bridge. */
  readonly isStrong?: boolean | undefined;
  readonly children: string;
};

/** Text drawn in the plot beside the mark it names, with a halo so it stays readable over marks and grid lines. */
export function LabelMark({ x, y, anchor = 'start', tone, isStrong = false, children }: LabelMarkProps): ReactNode {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      {...stylex.props(
        chartStyles.label,
        isStrong && chartStyles.strongLabel,
        chartStyles.haloLabel,
        styles.pointerless,
        tone !== undefined && styles.toned(chartToneOutlines[tone]),
      )}
    >
      {children}
    </text>
  );
}

/**
 * A faint dotted vertical guide: the position a reader inspects, a flagged period, or an event named beside it. It
 * claims no value, so it stays lighter than a `RuleMark`.
 */
export function GuideMark({
  x,
  top,
  bottom,
}: {
  readonly x: number;
  readonly top: number;
  readonly bottom: number;
}): ReactNode {
  return <line x1={x} x2={x} y1={top} y2={bottom} {...stylex.props(styles.guide, styles.pointerless)} />;
}

const RING_RADIUS = 4;

/** A ring in ink that points out one spot on a line: an annotated observation, or where the line reaches a value. */
export function RingMark({ x, y }: { readonly x: number; readonly y: number }): ReactNode {
  return <circle cx={x} cy={y} r={RING_RADIUS} {...stylex.props(styles.ring, styles.pointerless)} />;
}
