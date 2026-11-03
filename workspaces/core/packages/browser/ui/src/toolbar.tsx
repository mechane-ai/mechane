import { Button as BaseButton } from '@base-ui/react/button';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { SidebarToggle } from './sidebar.tsx';
import { colors, frame } from './tokens.stylex.ts';

const styles = stylex.create({
  toolbar: {
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
    fontSize: 14,
    lineHeight: '20px',
    minWidth: 0,
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 16,
    minWidth: 0,
    flexShrink: 1,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    fontSize: 'inherit',
    fontWeight: 400,
  },
  titleLabel: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  spacer: { flex: 1, minWidth: 0 },
  actions: { display: 'flex', alignItems: 'stretch', flexShrink: 0, marginLeft: 'auto' },
  action: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'gap': 8,
    'paddingTop': 0,
    'paddingBottom': 0,
    'paddingLeft': 16,
    'paddingRight': 16,
    'borderTopWidth': 0,
    'borderBottomWidth': 0,
    'borderRightWidth': 0,
    'borderLeftWidth': 1,
    'borderLeftStyle': 'solid',
    'borderLeftColor': colors.line,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'fontFamily': 'inherit',
    'fontSize': 'inherit',
    'fontWeight': 400,
    'lineHeight': 'inherit',
    'whiteSpace': 'nowrap',
    'cursor': 'pointer',
    ':hover': { backgroundColor: colors.canvas },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: -3 },
    ':disabled': { color: colors.faint, cursor: 'default' },
  },
  actionLabel: { display: { 'default': 'inline', '@container toolbar (max-width:600px)': 'none' } },
});

type ToolbarProps = {
  readonly title: ReactNode;
  readonly actions?: ReactNode;
  readonly breadcrumb?: boolean;
  readonly navigation?: boolean;
};

type ToolbarActionProps = ComponentProps<typeof BaseButton> & { readonly icon?: ReactNode };

export function Toolbar({ title, actions, breadcrumb = false, navigation = true }: ToolbarProps): ReactNode {
  const Title = breadcrumb ? 'nav' : 'h1';

  return (
    <header {...stylex.props(styles.toolbar)}>
      {navigation && <SidebarToggle />}
      <Title aria-label={breadcrumb ? 'Breadcrumb' : undefined} {...stylex.props(styles.title)}>
        <span {...stylex.props(styles.titleLabel)}>{title}</span>
      </Title>
      <div {...stylex.props(styles.spacer)} />
      {actions !== undefined && actions !== null && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </header>
  );
}

export function ToolbarAction({ icon, children, ...props }: ToolbarActionProps): ReactNode {
  return (
    <BaseButton
      {...props}
      aria-label={props['aria-label'] ?? (typeof children === 'string' ? children : undefined)}
      {...stylex.props(styles.action)}
    >
      {icon}
      {icon === undefined ? children : <span {...stylex.props(styles.actionLabel)}>{children}</span>}
    </BaseButton>
  );
}
