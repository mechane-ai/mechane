import * as stylex from '@stylexjs/stylex';
import { Circle, Layers3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  heading: { margin: 0, fontSize: 20, lineHeight: 1.4, fontWeight: 600, letterSpacing: '-0.4px', color: colors.ink },
  subheading: { margin: 0, fontSize: 13, fontWeight: 600, color: colors.ink },
  muted: { margin: 0, color: colors.muted, fontSize: 12, lineHeight: 1.6 },
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    color: colors.muted,
    overflowWrap: 'anywhere',
  },
  prose: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontSize: 13,
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
    padding: '2px 6px',
    color: colors.muted,
    backgroundColor: colors.canvas,
    fontSize: 11,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    width: 'fit-content',
  },
  positive: { color: colors.accent, backgroundColor: colors.accentSoft },
  warning: { color: colors.warning, backgroundColor: colors.warningSoft },
  negative: { color: colors.danger, backgroundColor: colors.dangerSoft },
  brand: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' },
});

type Children = { readonly children: ReactNode };

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

export function Brand(): ReactNode {
  return (
    <div {...stylex.props(styles.brand)}>
      <Layers3 size={19} aria-hidden />
      mechane
    </div>
  );
}
