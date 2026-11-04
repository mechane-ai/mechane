import * as stylex from '@stylexjs/stylex';
import { PanelLeft, X } from 'lucide-react';
import { createContext, useContext, useId } from 'react';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { Button, Drawer, IconButton } from '../../core/src/index.ts';
import { colors, conditions, controls, radii, spacing, typography } from '../../core/src/tokens.stylex.ts';
import { frame, frameConditions } from './frame.stylex.ts';

type SidebarState = {
  readonly isExpanded: boolean;
  readonly sidebarId: string;
  readonly drawerHandle: ReturnType<typeof Drawer.createHandle>;
  readonly navigationToggleRef: RefObject<HTMLButtonElement | null>;
  readonly onToggle: () => void;
  readonly onNavigate: () => void;
};

export const SidebarContext = createContext<SidebarState | null>(null);

const styles = stylex.create({
  header: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'stretch',
    height: frame.toolbarHeight,
    flexShrink: 0,
    minWidth: 0,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  emptyHeader: { display: { default: 'none', [frameConditions.sidebarMobile]: 'flex' } },
  headerContent: { display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 },
  navigationRegion: {
    'flex': 1,
    'minHeight': 0,
    'overflowY': 'auto',
    'overscrollBehavior': 'contain',
    'paddingBlock': frame.navigationInset,
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  footerRegion: { marginTop: 'auto', color: colors.muted },
  navigation: { display: 'flex', flexDirection: 'column', gap: spacing.xxs, paddingInline: frame.navigationPadding },
  collapsedNavigation: { paddingInline: { default: frame.navigationPadding, [frameConditions.sidebarCoarse]: 0 } },
  selected: { backgroundColor: colors.canvas },
  navigationCell: { display: 'flex', minWidth: 0, borderRadius: radii.sm },
  navigationControl: {
    justifyContent: 'flex-start',
    gap: spacing.sm,
    height: { default: frame.navigationHeight, [conditions.coarsePointer]: controls.coarseTarget },
    minHeight: frame.navigationHeight,
    width: '100%',
    minWidth: 0,
    paddingBlock: 0,
    paddingInline: frame.navigationPadding,
  },
  navigationLink: {
    'boxSizing': 'border-box',
    'display': 'flex',
    'alignItems': 'center',
    'borderRadius': radii.sm,
    'color': colors.ink,
    'backgroundColor': 'transparent',
    'fontFamily': typography.fontFamily,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'fontWeight': 400,
    'WebkitFontSmoothing': 'antialiased',
    'textAlign': 'left',
    'textDecorationLine': 'none',
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  collapsedButton: { justifyContent: { default: 'center', [frameConditions.sidebarMobile]: 'flex-start' } },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: controls.iconSize,
    height: controls.iconSize,
    flexShrink: 0,
  },
  label: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  grow: { display: 'flex', alignItems: 'center', gap: spacing.sm, flex: 1 },
  collapsedLabel: { display: { default: 'none', [frameConditions.sidebarMobile]: 'inline-flex' } },
  footer: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    height: frame.footerHeight,
    paddingInline: frame.footerPadding,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    whiteSpace: 'nowrap',
  },
  collapsedFooter: {
    justifyContent: { default: 'center', [frameConditions.sidebarMobile]: 'flex-start' },
    paddingInline: { default: 0, [frameConditions.sidebarMobile]: frame.footerPadding },
  },
  toggleCell: {
    boxSizing: 'border-box',
    flexShrink: 0,
    width: frame.toolbarHeight,
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: colors.line,
  },
  toggle: { height: '100%', width: '100%', minWidth: 0, borderRadius: 0, paddingBlock: 0, paddingInline: 0 },
  close: {
    height: '100%',
    width: frame.toolbarHeight,
    flexShrink: 0,
    borderRadius: 0,
    paddingBlock: 0,
    paddingInline: 0,
  },
  desktop: { display: { default: 'flex', [frameConditions.sidebarMobile]: 'none' } },
  mobile: { display: { default: 'none', [frameConditions.sidebarMobile]: 'flex' } },
});

type SidebarProps = {
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly close?: ReactNode;
  readonly children: ReactNode;
};

type NavigationProps = { readonly children: ReactNode; readonly label?: string };

type NavigationItemProps = Omit<ComponentProps<typeof Button>, 'variant' | 'tone' | 'size' | 'xstyle'> & {
  readonly icon?: ReactNode;
  readonly selected?: boolean;
};

type NavigationLinkProps = ComponentProps<'a'> & { readonly icon?: ReactNode; readonly selected?: boolean };

type SidebarLabelProps = { readonly children: ReactNode; readonly grow?: boolean };

type SidebarFooterProps = { readonly children: ReactNode };

export function Sidebar({ header, footer, close, children }: SidebarProps): ReactNode {
  const hasHeader = header !== undefined && header !== null;

  return (
    <>
      <div {...stylex.props(styles.header, !hasHeader && styles.emptyHeader)}>
        <div {...stylex.props(styles.headerContent)}>{header}</div>
        {close}
      </div>
      <div role="region" aria-label="Navigation links" tabIndex={0} {...stylex.props(styles.navigationRegion)}>
        {children}
      </div>
      {footer !== undefined && footer !== null && <div {...stylex.props(styles.footerRegion)}>{footer}</div>}
    </>
  );
}

export function SidebarClose(): ReactNode {
  return (
    <Drawer.Close render={<IconButton variant="ghost" aria-label="Close navigation" xstyle={styles.close} />}>
      <X size={16} aria-hidden />
    </Drawer.Close>
  );
}

export function Navigation({ children, label = 'Main' }: NavigationProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return (
    <nav aria-label={label} {...stylex.props(styles.navigation, isCollapsed && styles.collapsedNavigation)}>
      {children}
    </nav>
  );
}

export function NavigationItem({
  children,
  icon,
  selected = false,
  onClick,
  ...props
}: NavigationItemProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const labelId = useId();
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return (
    <div {...stylex.props(styles.navigationCell, selected && styles.selected)}>
      <Button
        {...props}
        variant="ghost"
        aria-current={selected ? 'page' : undefined}
        aria-labelledby={props['aria-labelledby'] ?? labelId}
        title={props.title ?? (typeof children === 'string' ? children : undefined)}
        onClick={(event) => {
          if (onClick !== undefined) {
            onClick(event);
          }

          if (!event.defaultPrevented && sidebar !== null) {
            sidebar.onNavigate();
          }
        }}
        xstyle={[styles.navigationControl, isCollapsed && styles.collapsedButton]}
      >
        {icon !== undefined && icon !== null && (
          <span aria-hidden {...stylex.props(styles.icon)}>
            {icon}
          </span>
        )}
        <span id={labelId} {...stylex.props(styles.label, isCollapsed && styles.collapsedLabel)}>
          {children}
        </span>
      </Button>
    </div>
  );
}

export function NavigationLink({
  children,
  icon,
  selected = false,
  onClick,
  className,
  style,
  ...props
}: NavigationLinkProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const labelId = useId();
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  const linkStyles = stylex.props(
    styles.navigationLink,
    styles.navigationControl,
    isCollapsed && styles.collapsedButton,
    selected && styles.selected,
  );

  return (
    <a
      {...props}
      aria-current={selected ? 'page' : undefined}
      aria-labelledby={props['aria-labelledby'] ?? labelId}
      title={props.title ?? (typeof children === 'string' ? children : undefined)}
      onClick={(event) => {
        if (onClick !== undefined) {
          onClick(event);
        }

        if (sidebar === null || event.button !== 0) {
          return;
        }

        const command = event.metaKey || event.ctrlKey;
        const alternate = event.shiftKey || event.altKey;

        if (command || alternate) {
          return;
        }

        // Routers handle this activation while preventing the anchor's browser navigation.
        sidebar.onNavigate();
      }}
      className={[linkStyles.className, className].filter(Boolean).join(' ')}
      style={{ ...linkStyles.style, ...style }}
    >
      {icon !== undefined && icon !== null && (
        <span aria-hidden {...stylex.props(styles.icon)}>
          {icon}
        </span>
      )}
      <span id={labelId} {...stylex.props(styles.label, isCollapsed && styles.collapsedLabel)}>
        {children}
      </span>
    </a>
  );
}

export function SidebarLabel({ children, grow = false }: SidebarLabelProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return (
    <span {...stylex.props(styles.label, grow && styles.grow, isCollapsed && styles.collapsedLabel)}>{children}</span>
  );
}

export function SidebarFooter({ children }: SidebarFooterProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return <div {...stylex.props(styles.footer, isCollapsed && styles.collapsedFooter)}>{children}</div>;
}

export function SidebarToggle(): ReactNode {
  const sidebar = useContext(SidebarContext);

  if (sidebar === null) {
    return null;
  }

  return (
    <>
      <div {...stylex.props(styles.toggleCell, styles.desktop)}>
        <IconButton
          ref={sidebar.navigationToggleRef}
          variant="ghost"
          aria-label={sidebar.isExpanded ? 'Collapse navigation' : 'Expand navigation'}
          aria-controls={sidebar.sidebarId}
          aria-expanded={sidebar.isExpanded}
          onClick={sidebar.onToggle}
          xstyle={styles.toggle}
        >
          <PanelLeft size={16} aria-hidden />
        </IconButton>
      </div>
      <div {...stylex.props(styles.toggleCell, styles.mobile)}>
        <Drawer.Trigger
          handle={sidebar.drawerHandle}
          render={<IconButton variant="ghost" aria-label="Open navigation" xstyle={styles.toggle} />}
        >
          <PanelLeft size={16} aria-hidden />
        </Drawer.Trigger>
      </div>
    </>
  );
}
