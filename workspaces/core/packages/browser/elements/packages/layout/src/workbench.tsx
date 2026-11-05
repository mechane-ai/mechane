import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing } from '../../foundations/src/tokens.stylex.ts';
import { frame } from './frame.stylex.ts';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: `calc(100dvh - ${frame.toolbarHeight})`,
    minWidth: 0,
    minHeight: 0,
  },
  header: {
    paddingBlock: spacing.lg,
    paddingInline: spacing.xl,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  body: { display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'clip' },
  main: { display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, minHeight: 0 },
  scroll: { overflowY: 'auto', flex: 1, minWidth: 0, minHeight: 0, padding: spacing.xl },
  footer: {
    flexShrink: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  aside: {
    boxSizing: 'border-box',
    width: { 'default': '440px', '@media (max-width:1100px)': '100%' },
    flexShrink: 0,
    overflowY: 'auto',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: colors.line,
  },
  obscured: { display: { 'default': 'flex', '@media (max-width:1100px)': 'none' } },
});

export function Workbench({
  header,
  children,
  inspector,
}: {
  readonly header: ReactNode;
  readonly children: ReactNode;
  readonly inspector?: ReactNode;
}): ReactNode {
  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.header)}>{header}</div>
      <div {...stylex.props(styles.body)}>
        <div {...stylex.props(styles.main, inspector !== undefined && inspector !== null && styles.obscured)}>
          {children}
        </div>
        {inspector !== undefined && inspector !== null && (
          <aside aria-label="Execution inspector" {...stylex.props(styles.aside)}>
            {inspector}
          </aside>
        )}
      </div>
    </div>
  );
}

export function WorkbenchScroll({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.scroll)}>{children}</div>;
}

export function WorkbenchFooter({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.footer)}>{children}</div>;
}
