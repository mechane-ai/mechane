import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import { Circle, CircleCheck, CircleX, Clock } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, conditions, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  text: {
    margin: 0,
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    WebkitFontSmoothing: 'antialiased',
    overflowWrap: 'anywhere',
  },
  body: { fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  caption: { fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
  ink: { color: colors.ink },
  muted: { color: colors.muted },
  heading: {
    margin: 0,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: { default: typography.headingSize, [conditions.compactText]: typography.compactHeadingSize },
    lineHeight: {
      default: typography.headingLineHeight,
      [conditions.compactText]: typography.compactHeadingLineHeight,
    },
    fontWeight: typography.strongWeight,
    letterSpacing: typography.headingTracking,
    color: colors.ink,
    overflowWrap: 'anywhere',
  },
  subheading: {
    margin: 0,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.sectionSize,
    lineHeight: typography.sectionLineHeight,
    fontWeight: typography.strongWeight,
    color: colors.ink,
    overflowWrap: 'anywhere',
  },
  mono: {
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.bodyLineHeight,
    overflowWrap: 'anywhere',
  },
  prose: {
    maxWidth: '72ch',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontSize: typography.inputSize,
    lineHeight: typography.proseLineHeight,
  },
  badge: {
    display: 'inline-flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.sm,
    paddingBlock: spacing.xxs,
    paddingInline: spacing.sm,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.captionSize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.mediumWeight,
    maxWidth: '100%',
    boxSizing: 'border-box',
    width: 'fit-content',
  },
  neutral: { color: colors.muted, backgroundColor: colors.canvas },
  positive: { color: colors.accent, backgroundColor: colors.accentSoft },
  warning: { color: colors.warning, backgroundColor: colors.warningSoft },
  negative: { color: colors.danger, backgroundColor: colors.dangerSoft },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: controls.gap,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
    maxWidth: '100%',
  },
  label: { minWidth: 0, overflowWrap: 'anywhere' },
  statusIcon: { flexShrink: 0 },
  neutralIcon: { color: colors.muted },
  positiveIcon: { color: colors.accent },
  warningIcon: { color: colors.warning },
  negativeIcon: { color: colors.danger },
});

type TextVariant = 'body' | 'caption' | 'mono' | 'prose';
type TextTone = 'ink' | 'muted';
type StatusTone = 'neutral' | 'positive' | 'warning' | 'negative';

type TextProps = ComponentProps<'span'> & {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  readonly xstyle?: PlacementStyle;
};

type HeadingProps = ComponentProps<'h1'> & { readonly compact?: boolean };
type SubheadingProps = ComponentProps<'h2'>;
type MutedProps = ComponentProps<'p'>;
type IdentifierProps = ComponentProps<'span'>;
type ProseProps = ComponentProps<'pre'>;
type BadgeProps = ComponentProps<'span'> & { readonly tone?: StatusTone };
type StatusProps = ComponentProps<'span'> & { readonly tone?: StatusTone };

const textVariants = {
  body: styles.body,
  caption: styles.caption,
  mono: styles.mono,
  prose: styles.prose,
} satisfies Record<TextVariant, stylex.StyleXStyles>;

const textTones = { ink: styles.ink, muted: styles.muted } satisfies Record<TextTone, stylex.StyleXStyles>;

const badgeTones = {
  neutral: styles.neutral,
  positive: styles.positive,
  warning: styles.warning,
  negative: styles.negative,
} satisfies Record<StatusTone, stylex.StyleXStyles>;

const statusTones = {
  neutral: styles.neutralIcon,
  positive: styles.positiveIcon,
  warning: styles.warningIcon,
  negative: styles.negativeIcon,
} satisfies Record<StatusTone, stylex.StyleXStyles>;

const statusIcons = { neutral: Circle, positive: CircleCheck, warning: Clock, negative: CircleX } satisfies Record<
  StatusTone,
  typeof Circle
>;

export function Text({ variant = 'body', tone = 'ink', xstyle, ...props }: TextProps): ReactNode {
  return <span {...mergeProps(stylex.props(styles.text, textVariants[variant], textTones[tone], xstyle), props)} />;
}

export function Heading({ compact = false, ...props }: HeadingProps): ReactNode {
  return <h1 {...mergeProps(stylex.props(compact ? styles.subheading : styles.heading), props)} />;
}

export function Subheading(props: SubheadingProps): ReactNode {
  return <h2 {...mergeProps(stylex.props(styles.subheading), props)} />;
}

export function Muted(props: MutedProps): ReactNode {
  return <p {...mergeProps(stylex.props(styles.text, styles.body, styles.muted), props)} />;
}

export function Identifier(props: IdentifierProps): ReactNode {
  return <span {...mergeProps(stylex.props(styles.text, styles.mono, styles.muted), props)} />;
}

export function Prose(props: ProseProps): ReactNode {
  return <pre {...mergeProps(stylex.props(styles.text, styles.prose, styles.ink), props)} />;
}

export function Badge({ children, tone = 'neutral', ...props }: BadgeProps): ReactNode {
  return (
    <span {...mergeProps(stylex.props(styles.badge, badgeTones[tone]), props)}>
      <Circle size={5} fill="currentColor" aria-hidden {...stylex.props(styles.statusIcon)} />
      <span {...stylex.props(styles.label)}>{children}</span>
    </span>
  );
}

export function Status({ children, tone = 'neutral', ...props }: StatusProps): ReactNode {
  const Icon = statusIcons[tone];

  return (
    <span {...mergeProps(stylex.props(styles.status), props)}>
      <Icon size={14} aria-hidden {...stylex.props(styles.statusIcon, statusTones[tone])} />
      <span {...stylex.props(styles.label)}>{children}</span>
    </span>
  );
}
