import * as stylex from '@stylexjs/stylex';
import { Circle, CircleCheck, CircleX, Clock, Layers3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  heading: {
    margin: 0,
    fontSize: { 'default': 36, '@media (max-width:639px)': 28 },
    lineHeight: { 'default': '44px', '@media (max-width:639px)': '36px' },
    fontWeight: 600,
    letterSpacing: '-0.035em',
    color: colors.ink,
    overflowWrap: 'anywhere',
  },
  subheading: { margin: 0, fontSize: 16, lineHeight: '22px', fontWeight: 600, color: colors.ink },
  muted: { margin: 0, color: colors.muted, fontSize: 13, lineHeight: 1.6 },
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    color: colors.muted,
    overflowWrap: 'anywhere',
  },
  prose: {
    maxWidth: '72ch',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontSize: 14,
    lineHeight: 1.7,
    margin: 0,
    color: colors.ink,
    fontFamily: 'inherit',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    borderRadius: 4,
    paddingBlock: 2,
    paddingInline: 6,
    color: colors.muted,
    backgroundColor: colors.canvas,
    fontSize: 12,
    lineHeight: '20px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    width: 'fit-content',
  },
  positive: { color: colors.accent, backgroundColor: colors.accentSoft },
  warning: { color: colors.warning, backgroundColor: colors.warningSoft },
  negative: { color: colors.danger, backgroundColor: colors.dangerSoft },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: colors.ink,
    fontSize: 13,
    lineHeight: '20px',
    fontWeight: 400,
    whiteSpace: 'nowrap',
  },
  statusIcon: { flexShrink: 0, color: colors.muted },
  positiveIcon: { color: colors.accent },
  warningIcon: { color: colors.warning },
  negativeIcon: { color: colors.danger },
  brand: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, lineHeight: '20px', fontWeight: 400 },
});

type Children = { readonly children: ReactNode };

const statusIcons = { neutral: Circle, positive: CircleCheck, warning: Clock, negative: CircleX };

export function Heading({ children }: Children): ReactNode {
  return <h1 {...stylex.props(styles.heading)}>{children}</h1>;
}

export function Subheading({ children }: Children): ReactNode {
  return <h2 {...stylex.props(styles.subheading)}>{children}</h2>;
}

export function Muted({ children }: Children): ReactNode {
  return <p {...stylex.props(styles.muted)}>{children}</p>;
}

export function Identifier({ children }: Children): ReactNode {
  return <span {...stylex.props(styles.mono)}>{children}</span>;
}

export function Prose({ children }: Children): ReactNode {
  return <pre {...stylex.props(styles.prose)}>{children}</pre>;
}

export function Badge({
  children,
  tone = 'neutral',
}: Children & { readonly tone?: 'neutral' | 'positive' | 'warning' | 'negative' }): ReactNode {
  return (
    <span
      {...stylex.props(
        styles.badge,
        tone === 'positive' && styles.positive,
        tone === 'warning' && styles.warning,
        tone === 'negative' && styles.negative,
      )}
    >
      <Circle size={5} fill="currentColor" aria-hidden />
      {children}
    </span>
  );
}

export function Status({
  children,
  tone = 'neutral',
}: Children & { readonly tone?: 'neutral' | 'positive' | 'warning' | 'negative' }): ReactNode {
  const Icon = statusIcons[tone];

  return (
    <span {...stylex.props(styles.status)}>
      <Icon
        size={14}
        aria-hidden
        {...stylex.props(
          styles.statusIcon,
          tone === 'positive' && styles.positiveIcon,
          tone === 'warning' && styles.warningIcon,
          tone === 'negative' && styles.negativeIcon,
        )}
      />
      {children}
    </span>
  );
}

export function Brand(): ReactNode {
  return (
    <div {...stylex.props(styles.brand)}>
      <Layers3 size={16} aria-hidden />
      mechane
    </div>
  );
}
