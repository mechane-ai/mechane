import { Meter as BaseMeter } from '@base-ui/react/meter';
import { Progress as BaseProgress } from '@base-ui/react/progress';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, radii, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    width: '100%',
    minWidth: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
  },
  heading: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  value: { color: colors.muted, fontVariantNumeric: 'tabular-nums' },
  track: { height: 4, width: '100%', borderRadius: radii.sm, backgroundColor: colors.line, overflow: 'hidden' },
  indicator: { height: '100%', backgroundColor: colors.ink, borderRadius: radii.sm },
  unknown: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.faint,
    boxSizing: 'border-box',
  },
});

export type ProgressProps = {
  readonly label: string;
  readonly value: number | null;
  readonly max: number;
  readonly valueLabel: string;
};

export type MeterProps = ProgressProps;

export function Progress({ label, value, max, valueLabel }: ProgressProps): ReactNode {
  return (
    <BaseProgress.Root
      value={value}
      max={max}
      locale="en-US"
      getAriaValueText={() => valueLabel}
      {...stylex.props(styles.root)}
    >
      <div {...stylex.props(styles.heading)}>
        <BaseProgress.Label>{label}</BaseProgress.Label>
        <span {...stylex.props(styles.value)}>{valueLabel}</span>
      </div>
      <BaseProgress.Track {...stylex.props(styles.track, value === null && styles.unknown)}>
        {value !== null && <BaseProgress.Indicator {...stylex.props(styles.indicator)} />}
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}

export function Meter({ label, value, max, valueLabel }: MeterProps): ReactNode {
  if (value === null) {
    return (
      <div {...stylex.props(styles.root)}>
        <div {...stylex.props(styles.heading)}>
          <span>{label}</span>
          <span {...stylex.props(styles.value)}>{valueLabel}</span>
        </div>
        <div aria-hidden {...stylex.props(styles.track, styles.unknown)} />
      </div>
    );
  }

  return (
    <BaseMeter.Root
      value={value}
      max={max}
      locale="en-US"
      getAriaValueText={() => valueLabel}
      {...stylex.props(styles.root)}
    >
      <div {...stylex.props(styles.heading)}>
        <BaseMeter.Label>{label}</BaseMeter.Label>
        <span {...stylex.props(styles.value)}>{valueLabel}</span>
      </div>
      <BaseMeter.Track {...stylex.props(styles.track)}>
        <BaseMeter.Indicator {...stylex.props(styles.indicator)} />
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
}
