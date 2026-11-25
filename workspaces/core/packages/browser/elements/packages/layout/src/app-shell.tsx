import * as stylex from '@stylexjs/stylex';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { headerStyles } from '../../foundations/src/header-styles.ts';
import { colors, pageGeometry, typography } from '../../foundations/src/tokens.stylex.ts';
import { Drawer } from '../../overlays/src/index.ts';
import { frame, frameConditions } from './frame.stylex.ts';
import { NavigationRailMenu } from './navigation-rail-menu.tsx';
import type { NavigationRailMenuProps } from './navigation-rail-menu.tsx';
import { NavigationRailContext, RailFooterGroup, RailGroup, RailPlaceholderItem } from './navigation-rail.tsx';
import type { NavigationRailProps } from './navigation-rail.tsx';
import { ShellBottomBar } from './shell-bottom-bar.tsx';
import { Sidebar, SidebarClose, SidebarContext } from './sidebar.tsx';

const styles = stylex.create({
  shell: {
    boxSizing: 'border-box',
    height: '100dvh',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr) auto',
    gridTemplateColumns: 'minmax(0, 1fr)',
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    WebkitFontSmoothing: 'antialiased',
  },
  workspace: { display: 'flex', minWidth: 0, minHeight: 0 },
  aboveBar: { '--mechane-workspace-safe-area-bottom': '0px' },
  sidebar: {
    boxSizing: 'border-box',
    display: { default: 'flex', [frameConditions.sidebarMobile]: 'none' },
    flexDirection: 'column',
    backgroundColor: colors.surface,
    position: 'sticky',
    top: 0,
    width: frame.sidebarWidth,
    flexShrink: 0,
    minHeight: 0,
    minWidth: 0,
  },
  collapsed: { width: pageGeometry.toolbarHeight },
  secondary: { width: `calc(${frame.sidebarWidth} - ${pageGeometry.toolbarHeight})` },
  rail: { width: pageGeometry.toolbarHeight },
  railBody: { flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' },
  railFooter: {
    flexShrink: 0,
    paddingBottom: 'var(--mechane-workspace-safe-area-bottom, env(safe-area-inset-bottom, 0px))',
  },
  hidden: { display: 'none' },
  main: {
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    overscrollBehaviorY: 'none',
  },
  drawer: { width: frame.sidebarWidth, maxWidth: 'calc(100vw - 48px)' },
});

type RailFooter =
  | { readonly navigation?: Pick<NavigationRailProps, 'label' | 'links'>; readonly menu: NavigationRailMenuProps }
  | { readonly placeholder: { readonly linkIcon?: ReactNode; readonly menuIcon: ReactNode } };

function ShellRailFooter({ footer }: { readonly footer: RailFooter }): ReactNode {
  return (
    <div {...stylex.props(styles.railFooter)}>
      <RailFooterGroup>
        {'placeholder' in footer ? (
          <>
            {footer.placeholder.linkIcon !== undefined && (
              <RailPlaceholderItem>{footer.placeholder.linkIcon}</RailPlaceholderItem>
            )}
            <RailPlaceholderItem>{footer.placeholder.menuIcon}</RailPlaceholderItem>
          </>
        ) : (
          <>
            {footer.navigation !== undefined && <RailGroup {...footer.navigation} isFooter />}
            <NavigationRailMenu {...footer.menu} />
          </>
        )}
      </RailFooterGroup>
    </div>
  );
}

type AppShellProps = {
  readonly rail?: ReactNode;
  readonly railFooter?: RailFooter;
  readonly sidebarHeader?: ReactNode;
  readonly sidebar: ReactNode;
  readonly footer?: ReactNode;
  readonly bottomBar?: ReactNode;
  readonly children: ReactNode;
  readonly mainId?: string;
  readonly shouldFocus?: boolean;
};

export function AppShell({
  rail,
  railFooter,
  sidebarHeader,
  sidebar,
  footer,
  bottomBar,
  children,
  mainId = 'main',
  shouldFocus = false,
}: AppShellProps): ReactNode {
  const hasBottomBar = bottomBar !== undefined && bottomBar !== null && typeof bottomBar !== 'boolean';
  const hasRail = rail !== undefined && rail !== null;
  const [isExpanded, setIsExpanded] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const shouldHideSidebar = shouldFocus || (hasRail && !isExpanded);
  const [drawerController] = useState(() => Drawer.createController());
  const sidebarId = useId();
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationToggleRef = useRef<HTMLButtonElement>(null);
  const drawerPopupRef = useRef<HTMLDivElement>(null);
  const didNavigate = useRef(false);

  useEffect(() => {
    const desktop = globalThis.matchMedia(frameConditions.sidebarDesktopQuery);

    function closeOnDesktop(): void {
      if (desktop.matches) {
        setIsOpen(false);
      }
    }

    desktop.addEventListener('change', closeOnDesktop);

    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        sidebarId,
        drawerController,
        navigationToggleRef,
        mobileNavigationToggleRef,
        onToggle: () => setIsExpanded((expanded) => !expanded),
        onNavigate: () => {
          didNavigate.current = isOpen;

          setIsOpen(false);
        },
      }}
    >
      <div {...stylex.props(styles.shell)}>
        <div {...stylex.props(styles.workspace, hasBottomBar && styles.aboveBar)}>
          {hasRail && (
            <div
              hidden={shouldFocus}
              {...stylex.props(styles.sidebar, headerStyles.inlineEnd, styles.rail, shouldFocus && styles.hidden)}
            >
              <div {...stylex.props(styles.railBody)}>{rail}</div>
              {railFooter !== undefined && <ShellRailFooter footer={railFooter} />}
            </div>
          )}
          <aside
            id={sidebarId}
            aria-label="Navigation"
            hidden={shouldHideSidebar}
            {...stylex.props(
              styles.sidebar,
              headerStyles.inlineEnd,
              hasRail && styles.secondary,
              !hasRail && !isExpanded && styles.collapsed,
              shouldHideSidebar && styles.hidden,
            )}
          >
            <Sidebar header={sidebarHeader} footer={footer}>
              {sidebar}
            </Sidebar>
          </aside>
          <main id={mainId} tabIndex={-1} {...stylex.props(styles.main)}>
            {children}
          </main>
        </div>
        {hasBottomBar && <ShellBottomBar>{bottomBar}</ShellBottomBar>}
      </div>
      {/* Screen dialogs must not inherit the navigation drawer's modal context. */}
      <Drawer.Root controller={drawerController} open={isOpen && !shouldFocus} onOpenChange={setIsOpen}>
        <Drawer.Backdrop />
        <Drawer.Popup
          ref={drawerPopupRef}
          xstyle={styles.drawer}
          finalFocus={() => {
            if (didNavigate.current) {
              didNavigate.current = false;

              const main = document.querySelector<HTMLElement>(`#${CSS.escape(mainId)}`);
              const focused = document.activeElement;

              if (focused instanceof HTMLElement) {
                const dialog = focused.closest('[role="dialog"], [role="alertdialog"]');

                if (dialog !== null && dialog !== drawerPopupRef.current) {
                  return focused;
                }
              }

              if (focused instanceof HTMLElement && main?.contains(focused) === true) {
                return focused;
              }

              return main;
            }

            if (globalThis.matchMedia(frameConditions.sidebarDesktopQuery).matches) {
              return navigationToggleRef.current;
            }

            return mobileNavigationToggleRef.current;
          }}
        >
          <Drawer.Title isVisuallyHidden>Navigation</Drawer.Title>
          <Sidebar
            header={sidebarHeader}
            navigationHeader={
              hasRail && <NavigationRailContext.Provider value="drawer">{rail}</NavigationRailContext.Provider>
            }
            footer={
              <>
                {footer}
                {hasRail && railFooter !== undefined && (
                  <NavigationRailContext.Provider value="drawer">
                    <ShellRailFooter footer={railFooter} />
                  </NavigationRailContext.Provider>
                )}
              </>
            }
            close={<SidebarClose />}
          >
            {sidebar}
          </Sidebar>
        </Drawer.Popup>
      </Drawer.Root>
    </SidebarContext.Provider>
  );
}
