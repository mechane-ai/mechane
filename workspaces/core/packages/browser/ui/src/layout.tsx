import { Dialog } from '@base-ui/react/dialog';
import * as stylex from '@stylexjs/stylex';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './actions.tsx';
import { Brand } from './text.tsx';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  layout: {
    minHeight: '100dvh',
    display: 'grid',
    gridTemplateColumns: { 'default': '216px minmax(0,1fr)', '@media (max-width:800px)': 'minmax(0,1fr)' },
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  sidebar: {
    display: { 'default': 'flex', '@media (max-width:800px)': 'none' },
    flexDirection: 'column',
    gap: 22,
    padding: '18px 12px',
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: colors.line,
    backgroundColor: colors.surface,
    position: 'sticky',
    top: 0,
    height: '100dvh',
    overflowY: 'auto',
  },
  footer: { marginTop: 'auto', paddingTop: 20 },
  main: { minWidth: 0 },
  header: {
    height: 49,
    padding: '0 24px',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 12,
    color: colors.muted,
  },
  mobile: { display: { 'default': 'none', '@media (max-width:800px)': 'flex' } },
  content: { padding: { 'default': '24px', '@media (max-width:800px)': '18px 14px' }, width: '100%', minWidth: 0 },
  backdrop: { position: 'fixed', inset: 0, backgroundColor: '#0006', zIndex: 20 },
  drawer: {
    position: 'fixed',
    inset: '0 auto 0 0',
    width: 260,
    padding: 16,
    backgroundColor: colors.surface,
    zIndex: 21,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    overflowY: 'auto',
  },
  drawerHeading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { margin: 0, fontSize: 14 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    'fontFamily': 'inherit',
    'textAlign': 'left',
    'borderWidth': 0,
    'display': 'flex',
    'alignItems': 'center',
    'gap': 9,
    'borderRadius': 4,
    'padding': '9px 10px',
    'backgroundColor': 'transparent',
    'fontSize': 13,
    'color': colors.muted,
    'cursor': 'pointer',
    ':hover': { backgroundColor: colors.canvas },
  },
  selected: { backgroundColor: colors.canvas, color: colors.ink },
});

export function Layout({
  sidebar,
  footer,
  header,
  children,
}: {
  readonly sidebar: ReactNode;
  readonly footer: ReactNode;
  readonly header?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <div {...stylex.props(styles.layout)}>
      <aside {...stylex.props(styles.sidebar)}>
        {sidebar}
        <div {...stylex.props(styles.footer)}>{footer}</div>
      </aside>
      <div {...stylex.props(styles.main)}>
        <header {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.mobile)}>
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger render={<Button tone="quiet" aria-label="Open navigation" />}>
                <Menu size={17} />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop {...stylex.props(styles.backdrop)} />
                <Dialog.Popup {...stylex.props(styles.drawer)}>
                  <div {...stylex.props(styles.drawerHeading)}>
                    <Dialog.Title {...stylex.props(styles.title)}>Navigation</Dialog.Title>
                    <Dialog.Close render={<Button tone="quiet" aria-label="Close navigation" />}>
                      <X size={16} />
                    </Dialog.Close>
                  </div>
                  {sidebar}
                  <div {...stylex.props(styles.footer)}>{footer}</div>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
          {header ?? <Brand />}
        </header>
        <main id="main" {...stylex.props(styles.content)}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Navigation({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <nav aria-label="Console" {...stylex.props(styles.nav)}>
      {children}
    </nav>
  );
}

export function NavigationItem({
  children,
  selected,
  onClick,
}: {
  readonly children: ReactNode;
  readonly selected: boolean;
  readonly onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      {...stylex.props(styles.navItem, selected && styles.selected)}
    >
      {children}
    </button>
  );
}
