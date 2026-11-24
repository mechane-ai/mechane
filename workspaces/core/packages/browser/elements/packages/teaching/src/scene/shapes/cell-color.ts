import type { NumericDomain } from '../../../../charts/src/index.ts';
import { heatmapColor } from '../../../../charts/src/matrix/index.ts';
import type { HeatmapPalette } from '../../../../charts/src/matrix/index.ts';

/**
 * The fill of a cell, from the heatmap charts' own scale: lightness of one hue for a magnitude, or two hues around zero
 * for a signed value. A grid with no palette, a value outside the domain, or a cell with no value gets no fill.
 */
export function cellFill({
  value,
  palette,
  domain,
}: {
  readonly value: number | undefined;
  readonly palette: HeatmapPalette | undefined;
  readonly domain: NumericDomain;
}): string | undefined {
  const isOutside = value === undefined || value < domain[0] || value > domain[1];

  if (palette === undefined || isOutside) {
    return undefined;
  }

  return heatmapColor(value, { domain, palette });
}
