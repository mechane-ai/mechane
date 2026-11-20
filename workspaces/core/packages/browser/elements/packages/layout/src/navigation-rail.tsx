import * as stylex from '@stylexjs/stylex';
import { mergeProps } from '@ui-sdk/react/primitive';
import { createContext, useContext } from 'react';
import type { ComponentProps, MouseEvent, MouseEventHandler, ReactNode } from 'react';
import { Button, IconButton, IconLink } from '../../core/src/index.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { controlStyles } from '../../foundations/src/control-styles.ts';
import { colors, controls, pageGeometry, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { Tooltip } from '../../overlays/src/index.ts';
import { SidebarContext } from './sidebar.tsx';

export const NavigationRailContext = createContext<'rail' | 'drawer'>('rail');

export type NavigationRailLink = Omit<
  ComponentProps<'a'>,
  'children' | 'href' | 'aria-label' | 'aria-current' | 'title'
> & { readonly label: string; readonly icon: ReactNode; readonly href: string; readonly isCurrent?: boolean };

export type NavigationRailProps = {
  readonly label: string;
  readonly links: ReadonlyArray<NavigationRailLink>;
  readonly action?: {
    readonly label: string;
    readonly icon: ReactNode;
    readonly onClick: MouseEventHandler<HTMLElement>;
  };
};

const styles = stylex.create({
  root: { display: 'flex', flexDirection: 'column', alignItems: 'stretch', flexShrink: 0, minWidth: 0 },
  desktopRail: {
    paddingBlock: {
      default: `calc((${pageGeometry.toolbarHeight} - ${controls.height}) / 2)`,
      [conditions.coarsePointer]: `calc((${pageGeometry.toolbarHeight} - ${controls.coarseTarget}) / 2)`,
    },
  },
  links: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs },
  action: { alignSelf: 'center' },
  mobileLinks: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  drawerFooterLinks: { padding: 0, gridTemplateColumns: 'minmax(0, 1fr)' },
  drawerFooterGroup: { alignItems: 'flex-start', paddingInline: spacing.xs },
  drawerFooterLink: { flexDirection: 'row', justifyContent: 'flex-start' },
  placeholderTarget: {
    display: 'grid',
    placeItems: 'center',
    width: { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    height: { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
  },
  selected: { ':is([aria-current="location"])': { backgroundColor: colors.canvas } },
  mobileLink: {
    'flexDirection': 'column',
    'minHeight': controls.coarseTarget,
    'paddingInline': spacing.xs,
    'paddingBlock': spacing.xs,
    'gap': spacing.xs,
    'borderColor': 'transparent',
    'backgroundColor': 'transparent',
    'color': colors.ink,
    'fontSize': typography.captionSize,
    'lineHeight': typography.captionLineHeight,
    'textDecorationLine': 'none',
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  icon: { display: 'inline-flex', flexShrink: 0, width: controls.iconSize, height: controls.iconSize },
  label: { minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' },
  divider: {
    borderWidth: 0,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    marginBlock: spacing.sm,
    marginInline: spacing.sm,
  },
  mobileAction: {
    display: 'grid',
    paddingInline: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  rounded: { borderRadius: radii.sm },
});

export function NavigationRail(props: NavigationRailProps): ReactNode {
  return <RailGroup {...props} />;
}

export function RailGroup({
  label,
  links,
  action,
  isFooter = false,
}: NavigationRailProps & { readonly isFooter?: boolean }): ReactNode {
  const isInDrawer = useContext(NavigationRailContext) === 'drawer';
  const sidebar = useContext(SidebarContext);

  function activateLink(onClick: NavigationRailLink['onClick'], event: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(event);

    const hasCommandModifier = event.metaKey || event.ctrlKey;
    const hasAlternateModifier = event.shiftKey || event.altKey;

    if (event.button !== 0 || hasCommandModifier || hasAlternateModifier) {
      return;
    }

    sidebar?.onNavigate();
  }

  const activateAction: MouseEventHandler<HTMLElement> = (event) => {
    action?.onClick(event);

    if (!event.defaultPrevented) {
      sidebar?.onNavigate();
    }
  };

  if (isInDrawer) {
    return (
      <div {...stylex.props(styles.root)}>
        <nav aria-label={label} {...stylex.props(styles.mobileLinks, isFooter && styles.drawerFooterLinks)}>
          {links.map(({ label: linkLabel, icon, isCurrent = false, ...link }) => (
            <a
              key={link.href}
              {...mergeProps(
                stylex.props(
                  controlStyles.base,
                  controlStyles.button,
                  styles.mobileLink,
                  isFooter && styles.drawerFooterLink,
                  styles.rounded,
                  styles.selected,
                ),
                link,
              )}
              aria-current={isCurrent ? 'location' : undefined}
              onClick={(event) => activateLink(link.onClick, event)}
            >
              <span aria-hidden {...stylex.props(styles.icon)}>
                {icon}
              </span>
              <span {...stylex.props(styles.label)}>{linkLabel}</span>
            </a>
          ))}
        </nav>
        {action !== undefined && (
          <div {...stylex.props(styles.mobileAction)}>
            <Button variant="ghost" onClick={activateAction}>
              <span aria-hidden {...stylex.props(styles.icon)}>
                {action.icon}
              </span>
              {action.label}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.root, !isFooter && styles.desktopRail)}>
      <nav aria-label={label} {...stylex.props(styles.links)}>
        {links.map(({ label: linkLabel, icon, isCurrent = false, ...link }) => (
          <Tooltip.Root key={link.href}>
            <Tooltip.Trigger
              render={
                <IconLink
                  {...mergeProps(stylex.props(styles.selected), link)}
                  aria-label={linkLabel}
                  aria-current={isCurrent ? 'location' : undefined}
                  onClick={(event) => activateLink(link.onClick, event)}
                />
              }
            >
              {icon}
            </Tooltip.Trigger>
            <Tooltip.Popup side="right">{linkLabel}</Tooltip.Popup>
          </Tooltip.Root>
        ))}
      </nav>
      {action !== undefined && (
        <>
          <hr {...stylex.props(styles.divider)} />
          <Tooltip.Root>
            <Tooltip.Trigger
              render={<IconButton variant="ghost" aria-label={action.label} xstyle={styles.action} />}
              onClick={activateAction}
            >
              {action.icon}
            </Tooltip.Trigger>
            <Tooltip.Popup side="right">{action.label}</Tooltip.Popup>
          </Tooltip.Root>
        </>
      )}
    </div>
  );
}

export function RailFooterGroup({ children }: { readonly children: ReactNode }): ReactNode {
  const isInDrawer = useContext(NavigationRailContext) === 'drawer';

  return (
    <div {...stylex.props(styles.links, styles.desktopRail, isInDrawer && styles.drawerFooterGroup)}>{children}</div>
  );
}

export function RailPlaceholderItem({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <span aria-hidden {...stylex.props(styles.placeholderTarget)}>
      {children}
    </span>
  );
}

export function NavigationRailPlaceholder({
  count,
  icon,
}: {
  readonly count: number;
  readonly icon: ReactNode;
}): ReactNode {
  return (
    <div aria-hidden {...stylex.props(styles.desktopRail, styles.links)}>
      {Array.from({ length: count }, (_, index) => (
        <RailPlaceholderItem key={index}>{icon}</RailPlaceholderItem>
      ))}
    </div>
  );
}
