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

/**
 * The edge drawn around a filled mark: its tone mixed toward the ink color. A bar reads as a crisp box on a light
 * surface and keeps a lighter rim on a dark one.
 */
export const chartToneOutlines: Readonly<Record<ChartTone, string>> = {
  series1: outline(chartColors.series1),
  series2: outline(chartColors.series2),
  series3: outline(chartColors.series3),
  series4: outline(chartColors.series4),
  series5: outline(chartColors.series5),
  series6: outline(chartColors.series6),
  positive: outline(chartColors.positive),
  negative: outline(chartColors.negative),
  neutral: outline(colors.muted),
};

function outline(color: string): string {
  return `color-mix(in srgb, ${color} 62%, ${colors.ink})`;
}
