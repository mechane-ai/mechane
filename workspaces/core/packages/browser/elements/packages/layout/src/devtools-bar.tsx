import * as stylex from '@stylexjs/stylex';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { headerStyles } from '../../foundations/src/header-styles.ts';
import { pageGeometry } from '../../foundations/src/tokens.stylex.ts';
import { useCommandShortcuts } from '../../navigation/src/commands/index.ts';

const styles = stylex.create({
  bar: { minHeight: `var(--mechane-devtools-bar-height, ${pageGeometry.toolbarHeight})` },
});

export function DevToolsBar(): ReactNode {
  return (
    <aside aria-label="Developer tools" {...stylex.props(headerStyles.row, headerStyles.blockStart, styles.bar)}>
      DevTools
    </aside>
  );
}

export function useDevToolsBar(storageKey: string): boolean {
  const [isVisible, setIsVisible] = useState(false);

  const unsaved = useRef(false);

  useLayoutEffect(() => {
    function restore() {
      if (unsaved.current) {
        return;
      }

      try {
        setIsVisible(globalThis.localStorage.getItem(storageKey) === '1');
      } catch {
        // The shortcut still works in memory when browser storage is unavailable.
      }
    }

    function storageChanged(event: StorageEvent) {
      if (event.key === storageKey || event.key === null) {
        restore();
      }
    }

    restore();
    globalThis.addEventListener('pageshow', restore);
    globalThis.addEventListener('storage', storageChanged);

    return () => {
      globalThis.removeEventListener('pageshow', restore);
      globalThis.removeEventListener('storage', storageChanged);
    };
  }, [storageKey]);

  useCommandShortcuts({
    target: typeof document === 'undefined' ? null : document.documentElement,
    isEnabled: true,
    commands: [
      {
        id: 'toggle-devtools-bar',
        label: 'Toggle DevTools',
        shortcut: { key: '\\', code: 'Backslash', meta: true, alt: true, shift: true },
        onSelect: () => {
          setIsVisible(!isVisible);

          try {
            globalThis.localStorage.setItem(storageKey, isVisible ? '0' : '1');

            unsaved.current = false;
          } catch {
            unsaved.current = true;
          }
        },
      },
    ],
  });

  return isVisible;
}
