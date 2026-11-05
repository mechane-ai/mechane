import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { frame, frameConditions } from './frame.stylex.ts';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: `calc(100dvh - ${frame.toolbarHeight})`,
    minWidth: 0,
    minHeight: 0,
    containerType: 'inline-size',
    containerName: 'workbench',
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
    WebkitFontSmoothing: 'antialiased',
  },
  header: {
    minWidth: 0,
    flexShrink: 0,
    paddingBlock: spacing.lg,
    paddingInline: spacing.xl,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  body: { display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'clip' },
  main: { position: 'relative', display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, minHeight: 0 },
  scroll: {
    'overflowY': 'auto',
    'overscrollBehaviorY': 'contain',
    'flex': 1,
    'minWidth': 0,
    'minHeight': 0,
    'padding': spacing.xl,
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  flush: { padding: 0 },
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
    width: { default: '440px', [frameConditions.workbenchCompact]: '100%' },
    minWidth: 0,
    flexShrink: 0,
    overflowY: 'auto',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: { default: 1, [frameConditions.workbenchCompact]: 0 },
    borderLeftStyle: 'solid',
    borderLeftColor: colors.line,
  },
  obscured: { display: { default: 'flex', [frameConditions.workbenchCompact]: 'none' } },
});

export function Workbench({
  header,
  children,
  inspector,
}: {
  readonly header?: ReactNode;
  readonly children: ReactNode;
  readonly inspector?: ReactNode;
}): ReactNode {
  return (
    <div {...stylex.props(styles.root)}>
      {header !== undefined && header !== null && <div {...stylex.props(styles.header)}>{header}</div>}
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

export function WorkbenchScroll({
  label,
  children,
  flush = false,
  scrollRestorationId,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly flush?: boolean;
  readonly scrollRestorationId?: string;
}): ReactNode {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      data-scroll-restoration-id={scrollRestorationId}
      {...stylex.props(styles.scroll, flush && styles.flush)}
    >
      {children}
    </div>
  );
}

export function WorkbenchFooter({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.footer)}>{children}</div>;
}
