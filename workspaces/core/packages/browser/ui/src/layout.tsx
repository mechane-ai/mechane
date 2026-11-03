import { Button as BaseButton } from '@base-ui/react/button';
import { Dialog } from '@base-ui/react/dialog';
import * as stylex from '@stylexjs/stylex';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { SidebarContext } from './sidebar.tsx';
import { colors, frame } from './tokens.stylex.ts';

const styles = stylex.create({
  layout: { minHeight: '100dvh', display: 'flex', backgroundColor: colors.surface, color: colors.ink },
  sidebar: {
    display: { 'default': 'flex', '@media (max-width:800px)': 'none' },
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
  navigation: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingTop: frame.navigationInset,
    paddingBottom: frame.navigationInset,
  },
  footer: { marginTop: 'auto', color: colors.muted, fontSize: 12, lineHeight: '18px' },
  main: { minWidth: 0, flex: 1 },
  backdrop: { position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0006', zIndex: 20 },
  drawer: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    width: frame.sidebarWidth,
    maxWidth: 'calc(100vw - 48px)',
    backgroundColor: colors.surface,
    color: colors.ink,
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: colors.line,
    zIndex: 21,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  drawerHeader: { display: 'flex', alignItems: 'center', minHeight: frame.toolbarHeight },
  drawerAccount: { flex: 1, minWidth: 0 },
  close: {
    'display': 'flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'height': frame.toolbarHeight,
    'width': frame.toolbarHeight,
    'flexShrink': 0,
    'paddingTop': 0,
    'paddingBottom': 0,
    'paddingLeft': 0,
    'paddingRight': 0,
    'borderTopWidth': 0,
    'borderRightWidth': 0,
    'borderBottomWidth': 1,
    'borderLeftWidth': 0,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'cursor': 'pointer',
    ':hover': { backgroundColor: colors.canvas },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: -3 },
  },
  accessibleTitle: {
    position: 'absolute',
    width: 1,
    height: 1,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    marginTop: -1,
    marginBottom: -1,
    marginLeft: -1,
    marginRight: -1,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
});

type LayoutProps = {
  readonly sidebarHeader?: ReactNode;
  readonly sidebar: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
};

export function Layout({ sidebarHeader, sidebar, footer, children }: LayoutProps): ReactNode {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const sidebarId = useId();

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <SidebarContext.Provider
        value={{
          isExpanded,
          sidebarId,
          onToggle: () => setIsExpanded((expanded) => !expanded),
          onNavigate: () => setIsOpen(false),
        }}
      >
        <div {...stylex.props(styles.layout)}>
          <aside
            id={sidebarId}
            aria-label="Navigation"
            {...stylex.props(styles.sidebar, !isExpanded && styles.collapsed)}
          >
            {sidebarHeader}
            <div {...stylex.props(styles.navigation)}>{sidebar}</div>
            {footer !== undefined && footer !== null && <div {...stylex.props(styles.footer)}>{footer}</div>}
          </aside>
          <main id="main" {...stylex.props(styles.main)}>
            {children}
          </main>
        </div>
        <Dialog.Portal>
          <Dialog.Backdrop {...stylex.props(styles.backdrop)} />
          <Dialog.Popup {...stylex.props(styles.drawer)}>
            <Dialog.Title {...stylex.props(styles.accessibleTitle)}>Navigation</Dialog.Title>
            <div {...stylex.props(styles.drawerHeader)}>
              <div {...stylex.props(styles.drawerAccount)}>{sidebarHeader}</div>
              <Dialog.Close render={<BaseButton aria-label="Close navigation" {...stylex.props(styles.close)} />}>
                <X size={16} aria-hidden />
              </Dialog.Close>
            </div>
            <div {...stylex.props(styles.navigation)}>{sidebar}</div>
            {footer !== undefined && footer !== null && <div {...stylex.props(styles.footer)}>{footer}</div>}
          </Dialog.Popup>
        </Dialog.Portal>
      </SidebarContext.Provider>
    </Dialog.Root>
  );
}
