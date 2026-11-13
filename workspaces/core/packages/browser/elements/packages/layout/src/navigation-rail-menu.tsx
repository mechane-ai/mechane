import * as stylex from '@stylexjs/stylex';
import { useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from '../../core/src/index.ts';
import { Menu, Tooltip } from '../../overlays/src/index.ts';
import { frameConditions } from './frame.stylex.ts';
import { NavigationRailContext } from './navigation-rail.tsx';

export type NavigationRailMenuProps = {
  readonly label: string;
  readonly icon: ReactNode;
  readonly children: ReactNode;
};

const placements = { rail: { side: 'right', align: 'end' }, drawer: { side: 'top', align: 'start' } } as const;
const styles = stylex.create({ popup: { width: 224 } });

export function NavigationRailMenu({ label, icon, children }: NavigationRailMenuProps): ReactNode {
  const presentation = useContext(NavigationRailContext);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const desktop = globalThis.matchMedia(frameConditions.sidebarDesktopQuery);

    function close(): void {
      setIsOpen(false);
    }

    desktop.addEventListener('change', close);

    return () => desktop.removeEventListener('change', close);
  }, []);

  return (
    <Menu.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <Tooltip.Provider>
        <Tooltip.Root disabled={isOpen || presentation === 'drawer'}>
          <Tooltip.Trigger render={<Menu.Trigger render={<IconButton variant="ghost" aria-label={label} />} />}>
            {icon}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="right">
              <Tooltip.Popup>{label}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <Menu.Portal>
        <Menu.Positioner {...placements[presentation]} sideOffset={4} collisionPadding={8}>
          <Menu.Popup aria-label={label} {...stylex.props(styles.popup)}>
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
