import { chartColors, colors } from './tokens.stylex.ts';

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
