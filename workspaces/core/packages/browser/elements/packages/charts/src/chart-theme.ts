import * as stylex from '@stylexjs/stylex';
import type { ChartTone } from '../../foundations/src/chart-tones.ts';
import { colors, typography } from '../../foundations/src/tokens.stylex.ts';

export type ChartLegendItem = { readonly id: string; readonly label: string; readonly tone: ChartTone };

export const chartStyles = stylex.create({
  plot: { minWidth: 0, overflow: 'hidden' },
  svg: { display: 'block', width: '100%', overflow: 'visible' },
  axis: { stroke: colors.line, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
  grid: { stroke: colors.line, strokeWidth: 1, strokeDasharray: '3 3', vectorEffect: 'non-scaling-stroke' },
  label: {
    fill: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    fontWeight: typography.regularWeight,
    fontVariantNumeric: 'tabular-nums',
  },
  mark: { strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' },
  selected: { stroke: colors.ink, strokeWidth: 2, vectorEffect: 'non-scaling-stroke' },
  inspectable: { outlineStyle: 'none' },
});
