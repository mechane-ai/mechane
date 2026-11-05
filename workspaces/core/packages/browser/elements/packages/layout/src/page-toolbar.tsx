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
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
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
    fontWeight: typography.regularWeight,
    outlineStyle: 'none',
  },
  label: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    paddingInline: spacing.sm,
    minWidth: 0,
    flexShrink: 1,
    marginLeft: 'auto',
  },
  views: { display: 'flex', alignItems: 'center', minWidth: 0, flexShrink: 0 },
  leading: { display: 'flex', alignItems: 'center', paddingInlineStart: spacing.sm, flexShrink: 0 },
  actionCell: { boxSizing: 'border-box', display: 'flex', alignItems: 'stretch', minWidth: 0 },
  action: { gap: spacing.sm, minWidth: 0, maxWidth: '100%' },
  icon: { display: 'inline-flex', flexShrink: 0, alignItems: 'center' },
  actionLabel: { display: { default: 'inline', [frameConditions.toolbarCompact]: 'none' } },
});

type PageToolbarProps = {
  readonly title: ReactNode;
  readonly actions?: ReactNode;
  readonly breadcrumb?: boolean;
  readonly navigation?: boolean;
  readonly views?: ReactNode;
  readonly leading?: ReactNode;
};

type ToolbarActionProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size' | 'xstyle'> & {
  readonly icon?: ReactNode;
};

export function PageToolbar({
  title,
  actions,
  breadcrumb = false,
  navigation = true,
  views,
  leading,
}: PageToolbarProps): ReactNode {
  const Title = breadcrumb ? 'nav' : 'h1';

  return (
    <div {...stylex.props(styles.toolbar)}>
      {leading === undefined ? navigation && <SidebarToggle /> : <div {...stylex.props(styles.leading)}>{leading}</div>}
      <Title
        tabIndex={breadcrumb ? undefined : -1}
        aria-label={breadcrumb ? 'Breadcrumb' : undefined}
        {...stylex.props(styles.title)}
      >
        <span {...stylex.props(styles.label)}>{title}</span>
      </Title>
      {views !== undefined && views !== null && <div {...stylex.props(styles.views)}>{views}</div>}
      {actions !== undefined && actions !== null && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </div>
  );
}

export function ToolbarAction({ icon, children, ...props }: ToolbarActionProps): ReactNode {
  const hasIcon = icon !== undefined && icon !== null;

  return (
    <div {...stylex.props(styles.actionCell)}>
      <Button
        {...props}
        variant="ghost"
        size="sm"
        aria-label={props['aria-label'] ?? (typeof children === 'string' ? children : undefined)}
        xstyle={styles.action}
      >
        {hasIcon && (
          <span aria-hidden {...stylex.props(styles.icon)}>
            {icon}
          </span>
        )}
        {hasIcon || typeof children === 'string' ? (
          <span {...stylex.props(styles.label, hasIcon && styles.actionLabel)}>{children}</span>
        ) : (
          children
        )}
      </Button>
    </div>
  );
}
