import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import type { NumericDomain } from '../plot/scale.ts';

/**
 * How values become color on an overlay. A `sequential` palette is one hue, from the surface color at the low end to
 * the full hue at the high end. A `diverging` palette is two hues around a neutral zero, for values that carry a sign.
 */
export type AttributionPalette = 'sequential' | 'diverging';

export type AttributionScale = { readonly domain: NumericDomain; readonly palette: AttributionPalette };

const PERCENT = 100;
const GRADIENT_STEPS = 12;

/** Why the scale cannot color its values, or undefined when it can. A diverging scale must span zero. */
export function attributionScaleError({ domain, palette }: AttributionScale): string | undefined {
  if (palette === 'diverging' && (domain[0] >= 0 || domain[1] <= 0)) {
    return 'A diverging color domain must include negative and positive values.';
  }

  return undefined;
}

/** The color of one value: its hue is the sign, its lightness is the size. */
export function attributionColor(value: number, { domain, palette }: AttributionScale): string {
  if (palette === 'diverging') {
    const isNegative = value < 0;
    const reach = Math.abs(isNegative ? domain[0] : domain[1]);
    const hue = isNegative ? chartToneColors.negative : chartToneColors.positive;

    return `color-mix(in srgb, ${hue} ${(Math.abs(value) / reach) * PERCENT}%, ${colors.surface})`;
  }

  const share = ((value - domain[0]) / (domain[1] - domain[0])) * PERCENT;

  return `color-mix(in srgb, ${chartToneColors.series1} ${share}%, ${colors.surface})`;
}

/** A CSS gradient from the low end of the scale to the high end, for the legend. */
export function attributionGradient(scale: AttributionScale): string {
  const [low, high] = scale.domain;

  const stops = Array.from({ length: GRADIENT_STEPS + 1 }, (_, step) =>
    attributionColor(low + ((high - low) * step) / GRADIENT_STEPS, scale),
  );

  return `linear-gradient(to right, ${stops.join(', ')})`;
}
