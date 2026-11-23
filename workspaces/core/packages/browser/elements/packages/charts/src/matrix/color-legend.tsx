import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { heatmapColor, heatmapScaleProblem } from './heatmap-scale.ts';
import type { HeatmapScale } from './heatmap-scale.ts';

export type ColorLegendProps = HeatmapScale & {
  /** What the color measures, with its unit and any normalization: "Share of actual class (row-normalized)". */
  readonly label: string;
  readonly valueFormat: ValueFormat;
  readonly locale: string;
};

const styles = stylex.create({
  root: {
    display: 'grid',
    gap: spacing.xs,
    margin: 0,
    minWidth: 0,
    maxWidth: 280,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  scale: { display: 'flex', height: 8, borderWidth: 1, borderStyle: 'solid', borderColor: colors.line },
  sample: (color: string) => ({ flex: 1, backgroundColor: color }),
  labels: { display: 'flex', justifyContent: 'space-between', gap: spacing.md, fontVariantNumeric: 'tabular-nums' },
  bound: { minWidth: 0 },
  endBound: { textAlign: 'end' },
});

const SAMPLE_COUNT = 20;

/**
 * The key to a heatmap's colors: what they measure, the domain's two ends and, for a diverging palette, the neutral
 * zero. Matrix and TokenHeatmap draw one; place one beside a custom heatmap that uses the same scale.
 */
export function ColorLegend({ label, domain, palette, valueFormat, locale }: ColorLegendProps): ReactNode {
  const problem = heatmapScaleProblem({ domain, palette });

  if (problem !== null) {
    return (
      <p role="status" {...stylex.props(styles.root)}>
        {problem}
      </p>
    );
  }

  function text(value: number): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  const samples = Array.from(
    { length: SAMPLE_COUNT + 1 },
    (_, step) => domain[0] + ((domain[1] - domain[0]) * step) / SAMPLE_COUNT,
  );

  return (
    <div aria-label={`${label}: ${text(domain[0])} to ${text(domain[1])}`} {...stylex.props(styles.root)}>
      <span>
        {label}
        {palette === 'diverging' && ` · Neutral: ${text(0)}`}
      </span>
      <div aria-hidden {...stylex.props(styles.scale)}>
        {samples.map((sample) => (
          <span key={sample} {...stylex.props(styles.sample(heatmapColor(sample, { domain, palette })))} />
        ))}
      </div>
      <div aria-hidden {...stylex.props(styles.labels)}>
        <span {...stylex.props(styles.bound)}>{text(domain[0])}</span>
        <span {...stylex.props(styles.bound, styles.endBound)}>{text(domain[1])}</span>
      </div>
    </div>
  );
}
