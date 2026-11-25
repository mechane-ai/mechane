import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { formatValue } from '../figure/figure-format.ts';
import { heatmapScaleProblem } from '../matrix/heatmap-scale.ts';
import type { HeatmapScale } from '../matrix/heatmap-scale.ts';
import { CellLayout, cellProblem, InvalidCell } from './cell-layout.tsx';
import type { CellDomainProps, CellProps } from './cell-layout.tsx';

export type HeatCellProps = CellProps &
  CellDomainProps & {
    /** The amount, or null for a value that was not recorded. */
    readonly value: number | null;
    /**
     * `sequential` is one hue that deepens with the value. `diverging` is two hues around a neutral zero, and its
     * domain must hold a negative and a positive bound.
     */
    readonly palette: HeatmapScale['palette'];
    /** Optional tighter range for color intensity so clustered high values keep clear contrast. */
    readonly colorDomain?: CellDomainProps['domain'] | undefined;
  };

/**
 * The strongest share of the hue, in percent. The text stays ink on every step of the ramp, so the ramp stops where ink
 * still reads. At this share the contrast of the ink on the fill is at least 5:1 in the light and the dark theme.
 */
const HUE_SHARE_MAX = 55;

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function heatBackground({ value, domain, palette }: HeatmapScale & { readonly value: number }): string {
  const isNegative = value < 0;

  const hue =
    palette === 'sequential' ? chartToneColors.series1 : chartToneColors[isNegative ? 'negative' : 'positive'];

  const rawFraction =
    palette === 'sequential'
      ? (value - domain[0]) / (domain[1] - domain[0])
      : Math.abs(value) / Math.abs(isNegative ? domain[0] : domain[1]);

  const fraction = clampUnit(rawFraction);

  return `color-mix(in srgb, ${hue} ${fraction * HUE_SHARE_MAX}%, ${colors.surface})`;
}

/**
 * The value written as text on a background whose strength follows it, so color is never the only carrier, with
 * "Unavailable" and no fill when missing. Use it in a table column where readers scan for high and low rows, such as a
 * score per task. Pass the column's `domain` and `palette` to every row so all rows share one ramp, lighter than the
 * `Matrix` heatmap so the ink text stays readable in both themes.
 */
export function HeatCell({
  value,
  domain,
  colorDomain,
  palette,
  locale,
  format,
  align,
  textWidth,
}: HeatCellProps): ReactNode {
  const problem = heatmapScaleProblem({ domain, palette }) ?? cellProblem({ domain, values: [value] });

  if (problem !== undefined) {
    return <InvalidCell message={problem} align={align} textWidth={textWidth} />;
  }

  const rampDomain = colorDomain ?? domain;

  return (
    <CellLayout
      align={align}
      textWidth={textWidth}
      state={value === null ? 'missing' : 'value'}
      background={value === null ? undefined : heatBackground({ value, domain: rampDomain, palette })}
    >
      {formatValue({ value, locale, format })}
    </CellLayout>
  );
}
