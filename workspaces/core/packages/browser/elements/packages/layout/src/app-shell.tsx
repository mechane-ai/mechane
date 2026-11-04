import * as stylex from '@stylexjs/stylex';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { colors, typography } from '../../foundations/src/tokens.stylex.ts';
import { Drawer } from '../../overlays/src/index.ts';
import { frame, frameConditions } from './frame.stylex.ts';
import { Sidebar, SidebarClose, SidebarContext } from './sidebar.tsx';

const styles = stylex.create({
  shell: {
    boxSizing: 'border-box',
    minHeight: '100dvh',
    display: 'flex',
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    WebkitFontSmoothing: 'antialiased',
  },
  sidebar: {
    boxSizing: 'border-box',
    display: { default: 'flex', [frameConditions.sidebarMobile]: 'none' },
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: colors.line,
    backgroundColor: colors.surface,
    position: 'sticky',
    top: 0,
    height: '100dvh',
    width: frame.sidebarWidth,
    flexShrink: 0,
    minHeight: 0,
    minWidth: 0,
  },
  collapsed: { width: frame.toolbarHeight },
  main: { minWidth: 0, flex: 1 },
  drawer: { width: frame.sidebarWidth, maxWidth: 'calc(100vw - 48px)' },
});

type AppShellProps = {
  readonly sidebarHeader?: ReactNode;
  readonly sidebar: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
};

export function AppShell({ sidebarHeader, sidebar, footer, children }: AppShellProps): ReactNode {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [drawerHandle] = useState(() => Drawer.createHandle());
  const sidebarId = useId();
  const navigationToggleRef = useRef<HTMLButtonElement>(null);

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
        drawerHandle,
        navigationToggleRef,
        onToggle: () => setIsExpanded((expanded) => !expanded),
        onNavigate: () => setIsOpen(false),
      }}
    >
      <div {...stylex.props(styles.shell)}>
        <aside
          id={sidebarId}
          aria-label="Navigation"
          {...stylex.props(styles.sidebar, !isExpanded && styles.collapsed)}
        >
          <Sidebar header={sidebarHeader} footer={footer}>
            {sidebar}
          </Sidebar>
        </aside>
        <main id="main" tabIndex={-1} {...stylex.props(styles.main)}>
          {children}
        </main>
      </div>
      {/* Screen dialogs must not inherit the navigation drawer's modal context. */}
      <Drawer.Root handle={drawerHandle} open={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Portal>
          <Drawer.Backdrop />
          <Drawer.Viewport>
            <Drawer.Popup
              xstyle={styles.drawer}
              finalFocus={() => {
                if (globalThis.matchMedia(frameConditions.sidebarDesktopQuery).matches) {
                  return navigationToggleRef.current;
                }

                return true;
              }}
            >
              <Drawer.Title visuallyHidden>Navigation</Drawer.Title>
              <Sidebar header={sidebarHeader} footer={footer} close={<SidebarClose />}>
                {sidebar}
              </Sidebar>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </SidebarContext.Provider>
  );
}
