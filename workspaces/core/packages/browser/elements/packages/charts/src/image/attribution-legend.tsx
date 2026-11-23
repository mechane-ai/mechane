import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { attributionGradient } from './attribution-ramp.ts';
import type { AttributionScale } from './attribution-ramp.ts';

/** As wide as the overlay's picture and strength control at most, so the three parts align. */
const OVERLAY_WIDTH_MAX_PX = 640;

const styles = stylex.create({
  legend: {
    display: 'grid',
    gap: spacing.xs,
    margin: 0,
    minWidth: 0,
    maxWidth: OVERLAY_WIDTH_MAX_PX,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  bar: (gradient: string) => ({
    height: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundImage: gradient,
  }),
  ends: { display: 'flex', justifyContent: 'space-between', gap: spacing.md, fontVariantNumeric: 'tabular-nums' },
});

export type AttributionLegendProps = AttributionScale & {
  readonly label: string;
  /** The lowest value, the highest value and, on a diverging scale, zero, already written in the figure's locale. */
  readonly ends: { readonly low: string; readonly high: string; readonly zero: string };
};

/** The color key of an overlay: what the values are, a bar from low to high, and the numbers at its ends. */
export function AttributionLegend({ label, ends, ...scale }: AttributionLegendProps): ReactNode {
  return (
    <div role="img" aria-label={`${label}: ${ends.low} to ${ends.high}`} {...stylex.props(styles.legend)}>
      <span aria-hidden>
        {label}
        {scale.palette === 'diverging' && ` · Neutral at ${ends.zero}`}
      </span>
      <div aria-hidden {...stylex.props(styles.bar(attributionGradient(scale)))} />
      <div aria-hidden {...stylex.props(styles.ends)}>
        <span>{ends.low}</span>
        <span>{ends.high}</span>
      </div>
    </div>
  );
}
