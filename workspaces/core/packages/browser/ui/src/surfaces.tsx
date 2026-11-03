import * as stylex from '@stylexjs/stylex';
import { Box } from 'lucide-react';
import type { ReactNode } from 'react';
import { Muted, Subheading } from './text.tsx';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  panel: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: 5,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  padded: { padding: 18 },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  between: { justifyContent: 'space-between' },
  stack: { display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 },
  compact: { gap: 6 },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '48px 20px',
    gap: 10,
  },
  emptyIcon: { color: colors.muted, marginBottom: 4 },
  notice: {
    padding: '10px 12px',
    borderRadius: 4,
    fontSize: 12,
    lineHeight: 1.6,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    overflowWrap: 'anywhere',
  },
  negative: { color: colors.danger, backgroundColor: colors.dangerSoft },
  divider: { borderWidth: 0, borderTopWidth: 1, borderStyle: 'solid', borderColor: colors.line, margin: 0 },
});

type Children = { readonly children: ReactNode };

export function Panel({ children, padded = true }: Children & { readonly padded?: boolean }): ReactNode {
  return <section {...stylex.props(styles.panel, padded && styles.padded)}>{children}</section>;
}

export function Row({ children, between = false }: Children & { readonly between?: boolean }): ReactNode {
  return <div {...stylex.props(styles.row, between && styles.between)}>{children}</div>;
}

export function Stack({ children, compact = false }: Children & { readonly compact?: boolean }): ReactNode {
  return <div {...stylex.props(styles.stack, compact && styles.compact)}>{children}</div>;
}

export function Divider(): ReactNode {
  return <hr {...stylex.props(styles.divider)} />;
}

export function EmptyState({
  title,
  children,
  action,
}: Children & { readonly title: string; readonly action?: ReactNode }): ReactNode {
  return (
    <div {...stylex.props(styles.empty)}>
      <Box size={22} aria-hidden {...stylex.props(styles.emptyIcon)} />
      <Subheading>{title}</Subheading>
      <Muted>{children}</Muted>
      {action}
    </div>
  );
}

export function Notice({ children, error = false }: Children & { readonly error?: boolean }): ReactNode {
  return (
    <div role={error ? 'alert' : 'status'} {...stylex.props(styles.notice, error && styles.negative)}>
      {children}
    </div>
  );
}
