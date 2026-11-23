import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { isFiniteDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';

/**
 * How a token's value becomes a shade. A `sequential` palette darkens one hue from the low end of the domain to the
 * high end. A `diverging` palette shades negative values in one hue and positive values in another, with zero left
 * unshaded.
 */
export type TokenPalette = 'sequential' | 'diverging';

/** The color scale of a text chart: the values its shades span and how they map to color. */
export type TokenScale = { readonly domain: NumericDomain; readonly palette: TokenPalette };

/**
 * The strongest share of the hue a shade takes. Ink text keeps a contrast of at least 4.5 to 1 on every shade, in the
 * light and the dark theme, up to this share.
 */
const SHADE_PERCENT_MAX = 60;
const LEGEND_STEPS = 12;

/** Why a color scale cannot be drawn, or undefined when it can. */
export function tokenScaleError({ domain, palette }: TokenScale): string | undefined {
  if (!isFiniteDomain(domain)) {
    return 'The color domain must contain two finite, increasing values.';
  }

  if (palette === 'diverging' && (domain[0] >= 0 || domain[1] <= 0)) {
    return 'A diverging color domain must hold negative and positive values, with zero between them.';
  }

  return undefined;
}

/** True when a value lies outside its declared color domain or is not finite. Charts reject such input. */
export function isOutsideScale(value: number, domain: NumericDomain): boolean {
  return !Number.isFinite(value) || value < domain[0] || value > domain[1];
}

/** The shade of a value, as a CSS color that follows the theme. The value must lie inside the domain. */
export function tokenShade(value: number, { domain, palette }: TokenScale): string {
  if (palette === 'diverging') {
    const endpoint = value < 0 ? domain[0] : domain[1];
    const tone = value < 0 ? chartToneColors.negative : chartToneColors.positive;
    const share = (Math.abs(value) / Math.abs(endpoint)) * SHADE_PERCENT_MAX;

    return `color-mix(in srgb, ${tone} ${share}%, ${colors.surface})`;
  }

  const share = ((value - domain[0]) / (domain[1] - domain[0])) * SHADE_PERCENT_MAX;

  return `color-mix(in srgb, ${chartToneColors.series1} ${share}%, ${colors.surface})`;
}

/** The CSS gradient a color legend draws: the scale's shades from the low end of the domain to the high end. */
export function tokenScaleGradient(scale: TokenScale): string {
  const [low, high] = scale.domain;

  const stops = Array.from({ length: LEGEND_STEPS + 1 }, (_, step) =>
    tokenShade(low + ((high - low) * step) / LEGEND_STEPS, scale),
  );

  return `linear-gradient(to right, ${stops.join(', ')})`;
}
