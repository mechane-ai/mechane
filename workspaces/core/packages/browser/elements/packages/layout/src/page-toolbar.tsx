import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { frame, frameConditions } from './frame.stylex.ts';
import { SidebarToggle } from './sidebar.tsx';

const styles = stylex.create({
  toolbar: {
    boxSizing: 'border-box',
    display: 'flex',
    containerType: 'inline-size',
    containerName: 'toolbar',
    alignItems: 'stretch',
    height: frame.toolbarHeight,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.inputSize,
    lineHeight: typography.bodyLineHeight,
    WebkitFontSmoothing: 'antialiased',
    minWidth: 0,
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    paddingInline: spacing.lg,
    minWidth: 0,
    flexShrink: 1,
    margin: 0,
    fontSize: 'inherit',
    fontWeight: 400,
  },
  label: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actions: { display: 'flex', alignItems: 'stretch', minWidth: 0, flexShrink: 0, marginLeft: 'auto' },
  actionCell: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'stretch',
    minWidth: 0,
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: colors.line,
  },
  action: {
    height: '100%',
    minWidth: frame.toolbarHeight,
    paddingBlock: 0,
    paddingInline: spacing.lg,
    borderRadius: 0,
    gap: spacing.sm,
  },
  actionLabel: { display: { default: 'inline', [frameConditions.toolbarCompact]: 'none' } },
});

type PageToolbarProps = {
  readonly title: ReactNode;
  readonly actions?: ReactNode;
  readonly breadcrumb?: boolean;
  readonly navigation?: boolean;
};

type ToolbarActionProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size' | 'xstyle'> & {
  readonly icon?: ReactNode;
};

export function PageToolbar({ title, actions, breadcrumb = false, navigation = true }: PageToolbarProps): ReactNode {
  const Title = breadcrumb ? 'nav' : 'h1';

  return (
    <header {...stylex.props(styles.toolbar)}>
      {navigation && <SidebarToggle />}
      <Title aria-label={breadcrumb ? 'Breadcrumb' : undefined} {...stylex.props(styles.title)}>
        <span {...stylex.props(styles.label)}>{title}</span>
      </Title>
      {actions !== undefined && actions !== null && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </header>
  );
}

export function ToolbarAction({ icon, children, ...props }: ToolbarActionProps): ReactNode {
  const hasIcon = icon !== undefined && icon !== null;

  return (
    <div {...stylex.props(styles.actionCell)}>
      <Button
        {...props}
        variant="ghost"
        size="md"
        aria-label={props['aria-label'] ?? (typeof children === 'string' ? children : undefined)}
        xstyle={styles.action}
      >
        {icon}
        {hasIcon ? <span {...stylex.props(styles.label, styles.actionLabel)}>{children}</span> : children}
      </Button>
    </div>
  );
}
