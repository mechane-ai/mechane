import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { heatmapColor, heatmapScaleProblem } from './heatmap-scale.ts';
import type { HeatmapScale } from './heatmap-scale.ts';

export type ColorLegendProps = HeatmapScale & {
  readonly label: string;
  readonly formatValue: (value: number) => string;
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

export function ColorLegend({ label, domain, palette, formatValue }: ColorLegendProps): ReactNode {
  const problem = heatmapScaleProblem({ domain, palette });

  if (problem !== null) {
    return (
      <p role="status" {...stylex.props(styles.root)}>
        {problem}
      </p>
    );
  }

  const samples = Array.from(
    { length: SAMPLE_COUNT + 1 },
    (_, step) => domain[0] + ((domain[1] - domain[0]) * step) / SAMPLE_COUNT,
  );

  return (
    <div aria-label={`${label}: ${formatValue(domain[0])} to ${formatValue(domain[1])}`} {...stylex.props(styles.root)}>
      <span>
        {label}
        {palette === 'diverging' && ` · Neutral: ${formatValue(0)}`}
      </span>
      <div aria-hidden {...stylex.props(styles.scale)}>
        {samples.map((sample) => (
          <span key={sample} {...stylex.props(styles.sample(heatmapColor(sample, { domain, palette })))} />
        ))}
      </div>
      <div aria-hidden {...stylex.props(styles.labels)}>
        <span {...stylex.props(styles.bound)}>{formatValue(domain[0])}</span>
        <span {...stylex.props(styles.bound, styles.endBound)}>{formatValue(domain[1])}</span>
      </div>
    </div>
  );
}
