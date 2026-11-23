import * as stylex from '@stylexjs/stylex';
import type { ChartTone } from '../../foundations/src/chart-tones.ts';
import { colors, controls, motion, typography } from '../../foundations/src/tokens.stylex.ts';
import type { ChartMarkShape } from './chart-series-marker.tsx';

export type ChartLegendItem = {
  readonly id: string;
  readonly label: string;
  readonly tone: ChartTone;
  /** The legend glyph for a mark that is not a filled area, such as a band or a tick. Absent means a swatch. */
  readonly shape?: ChartMarkShape | undefined;
};

export const chartStyles = stylex.create({
  plot: { minWidth: 0, overflow: 'hidden' },
  svg: { display: 'block', width: '100%', overflow: 'visible' },
  axis: { stroke: colors.ink, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
  grid: { stroke: colors.line, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
  baseline: { stroke: colors.ink, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
  label: {
    fill: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    fontWeight: typography.regularWeight,
    fontVariantNumeric: 'tabular-nums',
  },
  /**
   * Axis ticks and category, row, column, layer and node labels: the body face, with the tabular figures `label` sets
   * so numbers and dates align. Monospace is only for token text, code and ids.
   */
  tick: { fontFamily: typography.fontFamily },
  strongLabel: { fill: colors.ink, fontWeight: typography.mediumWeight },
  haloLabel: { paintOrder: 'stroke', stroke: colors.surface, strokeWidth: 3, strokeLinejoin: 'round' },
  mark: { strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' },
  /** A one-pixel edge for filled marks; pair it with the tone's outline color. */
  outlined: { strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
  /** The mark the application reports as selected. It keeps this edge while another mark is inspected. */
  selected: { stroke: colors.ink, strokeWidth: 2, vectorEffect: 'non-scaling-stroke' },
  /** The mark under the pointer or cursor, where the plot draws no guide band behind it. Lighter than selected. */
  inspected: { stroke: colors.ink, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
  inspectable: { outlineStyle: 'none' },
  /** Where the keyboard cursor rests, shown while the plot has keyboard focus. The plot carries `defaultMarker`. */
  cursor: {
    outlineWidth: controls.focusWidth,
    outlineColor: { 'default': colors.ink, '@media (forced-colors: active)': 'Highlight' },
    outlineStyle: { default: 'none', [stylex.when.ancestor(':focus-visible')]: 'dashed' },
    outlineOffset: 2,
  },
  /** The cursor on a curved mark with no stroke of its own: a dashed edge along the shape, not a box around it. */
  shapeCursor: {
    stroke: { 'default': colors.ink, '@media (forced-colors: active)': 'Highlight' },
    strokeWidth: { default: 0, [stylex.when.ancestor(':focus-visible')]: controls.focusWidth },
    strokeDasharray: '4 3',
    vectorEffect: 'non-scaling-stroke',
  },
  emphasis: {
    transitionProperty: 'opacity',
    transitionDuration: { 'default': motion.duration, '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: motion.easing,
  },
  receded: { opacity: 0.32 },
});
