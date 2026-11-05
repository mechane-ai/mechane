import * as stylex from '@stylexjs/stylex';
import { chartColors, colors, controls, typography } from '../../foundations/src/tokens.stylex.ts';

export type ChartTone =
  | 'series1'
  | 'series2'
  | 'series3'
  | 'series4'
  | 'series5'
  | 'series6'
  | 'positive'
  | 'negative'
  | 'neutral';

export const chartToneColors: Readonly<Record<ChartTone, string>> = {
  series1: chartColors.series1,
  series2: chartColors.series2,
  series3: chartColors.series3,
  series4: chartColors.series4,
  series5: chartColors.series5,
  series6: chartColors.series6,
  positive: chartColors.positive,
  negative: chartColors.negative,
  neutral: colors.muted,
};

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
  focus: {
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineWidth: controls.focusWidth,
      outlineOffset: `calc(-1 * ${controls.focusWidth})`,
    },
  },
});
