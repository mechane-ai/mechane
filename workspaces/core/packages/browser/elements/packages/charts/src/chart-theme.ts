import * as stylex from '@stylexjs/stylex';
import type { ChartTone } from '../../foundations/src/chart-tones.ts';
import { colors, motion, typography } from '../../foundations/src/tokens.stylex.ts';
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
  axis: { stroke: colors.line, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
  grid: { stroke: colors.line, strokeWidth: 1, strokeDasharray: '3 3', vectorEffect: 'non-scaling-stroke' },
  baseline: { stroke: colors.faint, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
  label: {
    fill: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    fontWeight: typography.regularWeight,
    fontVariantNumeric: 'tabular-nums',
  },
  strongLabel: { fill: colors.ink, fontWeight: typography.mediumWeight },
  haloLabel: { paintOrder: 'stroke', stroke: colors.surface, strokeWidth: 3, strokeLinejoin: 'round' },
  mark: { strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' },
  selected: { stroke: colors.ink, strokeWidth: 2, vectorEffect: 'non-scaling-stroke' },
  inspectable: { outlineStyle: 'none' },
  emphasis: {
    transitionProperty: 'opacity',
    transitionDuration: { 'default': motion.duration, '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: motion.easing,
  },
  receded: { opacity: 0.32 },
});
