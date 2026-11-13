import { Button as BaseButton } from '@base-ui/react/button';
import * as stylex from '@stylexjs/stylex';
import { PanelLeft, X } from 'lucide-react';
import { createContext, useContext, useId } from 'react';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { IconButton } from '../../core/src/index.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { headerStyles } from '../../foundations/src/header-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { colors, controls, pageGeometry, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { Drawer } from '../../overlays/src/index.ts';
import { frame, frameConditions } from './frame.stylex.ts';

type SidebarState = {
  readonly isExpanded: boolean;
  readonly sidebarId: string;
  readonly drawerHandle: ReturnType<typeof Drawer.createHandle>;
  readonly navigationToggleRef: RefObject<HTMLButtonElement | null>;
  readonly mobileNavigationToggleRef: RefObject<HTMLButtonElement | null>;
  readonly onToggle: () => void;
  readonly onNavigate: () => void;
};

export const SidebarContext = createContext<SidebarState | null>(null);

const styles = stylex.create({
  header: {
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    alignItems: 'stretch',
    height: pageGeometry.toolbarHeight,
    flexShrink: 0,
    minWidth: 0,
  },
  emptyHeader: { display: { default: 'none', [frameConditions.sidebarMobile]: 'flex' } },
  headerContent: { display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, paddingInline: pageGeometry.inset },
  collapsedHeader: {
    justifyContent: { default: 'center', [frameConditions.sidebarMobile]: 'flex-start' },
    paddingInline: { default: 0, [frameConditions.sidebarMobile]: pageGeometry.inset },
  },
  navigationRegion: {
    'flex': 1,
    'minHeight': 0,
    'overflowY': 'auto',
    'overscrollBehavior': 'contain',
    'outlineStyle': 'none',
    'paddingBlock': frame.navigationInset,
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  footerRegion: { flexShrink: 0, minWidth: 0, marginTop: 'auto', backgroundColor: colors.surface, color: colors.muted },
  navigation: { display: 'flex', flexDirection: 'column', paddingInline: frame.navigationPadding },
  section: { minWidth: 0 },
  sectionTitle: {
    minWidth: 0,
    paddingBlockStart: spacing.lg,
    paddingBlockEnd: spacing.xs,
    paddingInline: frame.navigationPadding,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.mediumWeight,
    overflowWrap: 'anywhere',
  },
  collapsedNavigation: { paddingInline: { default: frame.navigationPadding, [frameConditions.sidebarCoarse]: 0 } },
  selected: { backgroundColor: colors.canvas },
  navigationCell: { display: 'flex', minWidth: 0, borderRadius: radii.sm },
  navigationControl: {
    justifyContent: 'flex-start',
    gap: spacing.sm,
    height: { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    minHeight: controls.height,
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
    'fontWeight': typography.regularWeight,
    'WebkitFontSmoothing': 'antialiased',
    'textAlign': 'left',
    'textDecorationLine': 'none',
    ':hover:not(:active, [data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active:not([data-disabled])': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  navigationButton: {
    'borderWidth': 0,
    'cursor': 'pointer',
    ':is([data-disabled])': { opacity: controls.disabledOpacity, cursor: 'default' },
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
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: frame.footerHeight,
    minWidth: 0,
    flexShrink: 0,
    paddingInline: pageGeometry.inset,
    backgroundColor: colors.surface,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.regularWeight,
    whiteSpace: 'nowrap',
  },
  collapsedFooter: {
    justifyContent: { default: 'center', [frameConditions.sidebarMobile]: 'flex-start' },
    paddingInline: { default: 0, [frameConditions.sidebarMobile]: pageGeometry.inset },
  },
  inlineFooter: {},
  navigationFooter: { display: 'block', paddingInline: 0, paddingBlock: spacing.sm },
  toggleCell: {
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: pageGeometry.toolbarHeight,
  },
  closeCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: pageGeometry.toolbarHeight,
    flexShrink: 0,
  },
  desktop: { display: { default: 'flex', [frameConditions.sidebarMobile]: 'none' } },
  mobile: { display: { default: 'none', [frameConditions.sidebarMobile]: 'flex' } },
});

type SidebarProps = {
  readonly header?: ReactNode;
  readonly navigationHeader?: ReactNode;
  readonly footer?: ReactNode;
  readonly close?: ReactNode;
  readonly children: ReactNode;
};

type NavigationProps = { readonly children: ReactNode; readonly label?: string };

type NavigationItemProps = ComponentProps<typeof BaseButton> & {
  readonly icon?: ReactNode;
  readonly isSelected?: boolean;
  readonly shouldCloseOnActivate?: boolean;
};

type NavigationLinkProps = ComponentProps<'a'> & { readonly icon?: ReactNode; readonly isSelected?: boolean };

type SidebarLabelProps = { readonly children: ReactNode; readonly shouldGrow?: boolean };

type SidebarFooterLayout = 'inline' | 'navigation';
type SidebarFooterProps = { readonly children: ReactNode; readonly layout?: SidebarFooterLayout };

const footerLayouts = { inline: styles.inlineFooter, navigation: styles.navigationFooter } satisfies Record<
  SidebarFooterLayout,
  stylex.StyleXStyles
>;

export function Sidebar({ header, navigationHeader, footer, close, children }: SidebarProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;
  const hasHeader = header !== undefined && header !== null;

  return (
    <>
      <div {...stylex.props(styles.header, headerStyles.blockEnd, !hasHeader && styles.emptyHeader)}>
        <div {...stylex.props(styles.headerContent, isCollapsed && styles.collapsedHeader)}>{header}</div>
        {close}
      </div>
      {navigationHeader}
      <div role="region" aria-label="Navigation links" {...stylex.props(styles.navigationRegion)}>
        {children}
      </div>
      {footer !== undefined && footer !== null && <div {...stylex.props(styles.footerRegion)}>{footer}</div>}
    </>
  );
}

export function SidebarClose(): ReactNode {
  return (
    <div {...stylex.props(styles.closeCell)}>
      <Drawer.Close render={<IconButton variant="ghost" aria-label="Close navigation" />}>
        <X size={16} aria-hidden />
      </Drawer.Close>
    </div>
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

export function NavigationSection({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}): ReactNode {
  const sidebar = useContext(SidebarContext);
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;
  const labelId = useId();

  return (
    <section aria-labelledby={labelId} {...stylex.props(styles.section)}>
      <div id={labelId} {...stylex.props(styles.sectionTitle, isCollapsed && styles.collapsedLabel)}>
        {label}
      </div>
      {children}
    </section>
  );
}

export function NavigationItem({
  children,
  icon,
  isSelected = false,
  shouldCloseOnActivate = true,
  onClick,
  className,
  style,
  ...props
}: NavigationItemProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const labelId = useId();
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return (
    <div {...stylex.props(styles.navigationCell, isSelected && styles.selected)}>
      <BaseButton
        {...props}
        {...mergeStyles<BaseButton.State>({
          className,
          style,
          styles: stylex.props(
            styles.navigationLink,
            styles.navigationButton,
            styles.navigationControl,
            isCollapsed && styles.collapsedButton,
          ),
        })}
        aria-current={isSelected ? 'page' : undefined}
        aria-labelledby={props['aria-labelledby'] ?? (props['aria-label'] === undefined ? labelId : undefined)}
        title={props.title ?? (typeof children === 'string' ? children : undefined)}
        onClick={(event) => {
          if (onClick !== undefined) {
            onClick(event);
          }

          if (!event.defaultPrevented && sidebar !== null && shouldCloseOnActivate) {
            sidebar.onNavigate();
          }
        }}
      >
        {icon !== undefined && icon !== null && (
          <span aria-hidden {...stylex.props(styles.icon)}>
            {icon}
          </span>
        )}
        <span id={labelId} {...stylex.props(styles.label, isCollapsed && styles.collapsedLabel)}>
          {children}
        </span>
      </BaseButton>
    </div>
  );
}

export function NavigationLink({
  children,
  icon,
  isSelected = false,
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
    isSelected && styles.selected,
  );

  return (
    <a
      {...props}
      aria-current={isSelected ? 'page' : undefined}
      aria-labelledby={props['aria-labelledby'] ?? (props['aria-label'] === undefined ? labelId : undefined)}
      title={props.title ?? (typeof children === 'string' ? children : undefined)}
      onClick={(event) => {
        if (onClick !== undefined) {
          onClick(event);
        }

        if (sidebar === null || event.button !== 0) {
          return;
        }

        const hasCommandModifier = event.metaKey || event.ctrlKey;
        const hasAlternateModifier = event.shiftKey || event.altKey;

        if (hasCommandModifier || hasAlternateModifier) {
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

export function SidebarLabel({ children, shouldGrow = false }: SidebarLabelProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return (
    <span {...stylex.props(styles.label, shouldGrow && styles.grow, isCollapsed && styles.collapsedLabel)}>
      {children}
    </span>
  );
}

export function SidebarFooter({ children, layout = 'inline' }: SidebarFooterProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return (
    <div
      {...stylex.props(
        styles.footer,
        headerStyles.blockStart,
        isCollapsed && styles.collapsedFooter,
        footerLayouts[layout],
      )}
    >
      {children}
    </div>
  );
}

export function SidebarToggle(): ReactNode {
  const sidebar = useContext(SidebarContext);

  if (sidebar === null) {
    return null;
  }

  return (
    <>
      <div {...stylex.props(styles.toggleCell, headerStyles.inlineEnd, styles.desktop)}>
        <IconButton
          ref={sidebar.navigationToggleRef}
          variant="ghost"
          aria-label={sidebar.isExpanded ? 'Collapse navigation' : 'Expand navigation'}
          aria-controls={sidebar.sidebarId}
          aria-expanded={sidebar.isExpanded}
          onClick={sidebar.onToggle}
        >
          <PanelLeft size={16} aria-hidden />
        </IconButton>
      </div>
      <div {...stylex.props(styles.toggleCell, headerStyles.inlineEnd, styles.mobile)}>
        <Drawer.Trigger
          ref={sidebar.mobileNavigationToggleRef}
          handle={sidebar.drawerHandle}
          render={<IconButton variant="ghost" aria-label="Open navigation" />}
        >
          <PanelLeft size={16} aria-hidden />
        </Drawer.Trigger>
      </div>
    </>
  );
}
