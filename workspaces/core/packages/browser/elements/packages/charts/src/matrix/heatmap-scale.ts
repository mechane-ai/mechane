import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { isFiniteDomain } from '../chart-input.tsx';

export type HeatmapPalette = 'sequential' | 'diverging';

export type HeatmapScale = { readonly domain: readonly [number, number]; readonly palette: HeatmapPalette };

const PERCENT = 100;

export function heatmapScaleProblem({ domain, palette }: HeatmapScale): string | null {
  if (!isFiniteDomain(domain)) {
    return 'The color domain must contain two finite, increasing endpoints.';
  }

  if (palette === 'diverging' && (domain[0] >= 0 || domain[1] <= 0)) {
    return 'A diverging color domain must include negative and positive values.';
  }

  return null;
}

export function isHeatmapValueInDomain(value: number, domain: readonly [number, number]): boolean {
  return value >= domain[0] && value <= domain[1];
}

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
