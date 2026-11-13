import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { Notice, SkeletonText } from '../../feedback/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import type { ChartLegendItem } from './chart-theme.ts';
import { chartToneColors } from './chart-theme.ts';

const styles = stylex.create({
  root: { display: 'flex', flexWrap: 'wrap', gap: spacing.lg, margin: 0, minWidth: 0 },
  metric: { minWidth: 0 },
  divided: {
    paddingInlineStart: spacing.lg,
    borderInlineStartWidth: 1,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    color: colors.muted,
    fontSize: typography.captionSize,
  },
  swatch: (color: string) => ({ width: 8, height: 8, flexShrink: 0, backgroundColor: color }),
  value: {
    margin: 0,
    color: colors.ink,
    fontSize: typography.compactHeadingSize,
    lineHeight: typography.compactHeadingLineHeight,
    fontWeight: typography.mediumWeight,
    letterSpacing: typography.headingTracking,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
});

export function ChartSeriesSummary({
  series,
  values,
}: {
  readonly series: ReadonlyArray<ChartLegendItem>;
  readonly values: Readonly<Record<string, string | undefined>>;
}): ReactNode {
  const keys = Object.keys(values);
  const hasExactSeries = keys.length === series.length && series.every((item) => Object.hasOwn(values, item.id));

  if (!hasExactSeries) {
    return <Notice hasError>Period values must match the chart series identifiers.</Notice>;
  }

  return (
    <dl aria-label="Period summary" {...stylex.props(styles.root)}>
      {series.map((item, index) => (
        <div key={item.id} {...stylex.props(styles.metric, index > 0 && styles.divided)}>
          <dt {...stylex.props(styles.label)}>
            <span aria-hidden {...stylex.props(styles.swatch(chartToneColors[item.tone]))} />
            {item.label}
          </dt>
          <dd {...stylex.props(styles.value)}>
            {values[item.id] === undefined ? <SkeletonText width="6ch" /> : values[item.id]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
