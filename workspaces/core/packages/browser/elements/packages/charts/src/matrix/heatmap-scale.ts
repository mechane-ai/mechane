import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { isFiniteDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';

/** Sequential lightness of one hue for a magnitude, or two hues around a neutral zero for a signed value. */
export type HeatmapPalette = 'sequential' | 'diverging';

/** The color domain of a heatmap and how its values map to color. Values outside the domain draw no color. */
export type HeatmapScale = { readonly domain: NumericDomain; readonly palette: HeatmapPalette };

const PERCENT = 100;

/** Why a color scale cannot be drawn, or null when it can. */
export function heatmapScaleProblem({ domain, palette }: HeatmapScale): string | null {
  if (!isFiniteDomain(domain)) {
    return 'The color domain must contain two finite, increasing endpoints.';
  }

  if (palette === 'diverging' && (domain[0] >= 0 || domain[1] <= 0)) {
    return 'A diverging color domain must include negative and positive values.';
  }

  return null;
}

/** Whether a value lies inside the color domain, endpoints included. */
export function isHeatmapValueInDomain(value: number, domain: NumericDomain): boolean {
  return value >= domain[0] && value <= domain[1];
}

/** The fill of a value inside the domain: more of the hue for a larger magnitude. */
export function heatmapColor(value: number, { domain, palette }: HeatmapScale): string {
  if (palette === 'diverging') {
    const endpoint = value < 0 ? domain[0] : domain[1];
    const intensity = (Math.abs(value) / Math.abs(endpoint)) * PERCENT;
    const tone = value < 0 ? chartToneColors.negative : chartToneColors.positive;

    return `color-mix(in srgb, ${tone} ${intensity}%, ${colors.surface})`;
  }

  const intensity = ((value - domain[0]) / (domain[1] - domain[0])) * PERCENT;

  return `color-mix(in srgb, ${chartToneColors.series1} ${intensity}%, ${colors.surface})`;
}
