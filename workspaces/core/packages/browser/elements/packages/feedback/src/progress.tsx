import * as stylex from '@stylexjs/stylex';
import { MeterIndicator, MeterLabel, MeterTrack, Meter as SdkMeter } from '@ui-sdk/react/meter';
import { ProgressIndicator, ProgressLabel, ProgressTrack, Progress as SdkProgress } from '@ui-sdk/react/progress';
import type { ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { chartToneColors } from '../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../foundations/src/chart-tones.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

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
    fontWeight: typography.regularWeight,
    color: colors.ink,
    overflowWrap: 'anywhere',
  },
  heading: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  label: { minWidth: 0, maxWidth: '100%' },
  value: { minWidth: 0, maxWidth: '100%', color: colors.muted, fontVariantNumeric: 'tabular-nums' },
  track: { height: 4, width: '100%', borderRadius: radii.sm, backgroundColor: colors.line, overflow: 'hidden' },
  indicator: { height: '100%', backgroundColor: colors.ink, borderRadius: radii.sm },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' },
  inlineHeading: { display: 'contents' },
  inlineValue: { color: colors.ink },
  inlineTrack: { width: { default: 48, [conditions.compactTable]: 24 }, flexShrink: 0 },
  tone: (color: string) => ({ backgroundColor: color }),
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

type MeterLayout = 'stacked' | 'inline';

export type MeterProps = ProgressProps & { readonly layout?: MeterLayout; readonly tone?: ChartTone };

const meterLayouts = {
  stacked: { root: undefined, heading: undefined, label: undefined, value: undefined, track: undefined },
  inline: {
    root: styles.inline,
    heading: styles.inlineHeading,
    label: accessibility.hidden,
    value: styles.inlineValue,
    track: styles.inlineTrack,
  },
} satisfies Record<
  MeterLayout,
  {
    readonly root: stylex.StyleXStyles | undefined;
    readonly heading: stylex.StyleXStyles | undefined;
    readonly label: stylex.StyleXStyles | undefined;
    readonly value: stylex.StyleXStyles | undefined;
    readonly track: stylex.StyleXStyles | undefined;
  }
>;

export function Progress({ label, value, max, valueLabel }: ProgressProps): ReactNode {
  return (
    <SdkProgress value={value} max={max} locale="en-US" getValueLabel={() => valueLabel} {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.heading)}>
        <ProgressLabel {...stylex.props(styles.label)}>{label}</ProgressLabel>
        <span {...stylex.props(styles.value)}>{valueLabel}</span>
      </div>
      <ProgressTrack {...stylex.props(styles.track, value === null && styles.unknown)}>
        {value !== null && <ProgressIndicator {...stylex.props(styles.indicator)} />}
      </ProgressTrack>
    </SdkProgress>
  );
}

export function Meter({ label, value, max, valueLabel, layout = 'stacked', tone }: MeterProps): ReactNode {
  const appearance = meterLayouts[layout];
  const indicatorTone = tone === undefined ? undefined : styles.tone(chartToneColors[tone]);

  const hasFiniteValue = value !== null && Number.isFinite(value);
  const hasValidMaximum = Number.isFinite(max) && max > 0;
  const isWithinRange = hasFiniteValue && value >= 0 && value <= max;
  const hasValue = hasValidMaximum && isWithinRange;

  if (!hasValue) {
    return (
      <div {...stylex.props(styles.root, appearance.root)}>
        <div {...stylex.props(styles.heading, appearance.heading)}>
          <span {...stylex.props(styles.label, appearance.label)}>{label}</span>
          <span {...stylex.props(styles.value, appearance.value)}>{valueLabel}</span>
        </div>
        <div aria-hidden {...stylex.props(styles.track, appearance.track, styles.unknown)} />
      </div>
    );
  }

  return (
    <SdkMeter
      value={value}
      max={max}
      locale="en-US"
      getValueLabel={() => valueLabel}
      {...stylex.props(styles.root, appearance.root)}
    >
      <div {...stylex.props(styles.heading, appearance.heading)}>
        <MeterLabel {...stylex.props(styles.label, appearance.label)}>{label}</MeterLabel>
        <span {...stylex.props(styles.value, appearance.value)}>{valueLabel}</span>
      </div>
      <MeterTrack {...stylex.props(styles.track, appearance.track)}>
        <MeterIndicator {...stylex.props(styles.indicator, indicatorTone)} />
      </MeterTrack>
    </SdkMeter>
  );
}
