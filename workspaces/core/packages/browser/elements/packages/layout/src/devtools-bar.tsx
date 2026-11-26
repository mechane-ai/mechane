import * as stylex from '@stylexjs/stylex';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { headerStyles } from '../../foundations/src/header-styles.ts';
import { colors, pageGeometry, spacing } from '../../foundations/src/tokens.stylex.ts';
import { useCommandShortcuts } from '../../navigation/src/commands/index.ts';

const styles = stylex.create({
  bar: { gap: spacing.md, minHeight: `var(--mechane-devtools-bar-height, ${pageGeometry.toolbarHeight})` },
});

const toneStyles = stylex.create({ neutral: {}, accent: { backgroundColor: colors.accentSoft, color: colors.accent } });

type DevToolsBarProps = {
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly tone?: 'neutral' | 'accent';
};

export function DevToolsBar({ children = 'DevTools', actions, tone = 'neutral' }: DevToolsBarProps): ReactNode {
  return (
    <aside
      aria-label="Developer tools"
      {...stylex.props(headerStyles.row, headerStyles.blockStart, styles.bar, toneStyles[tone])}
    >
      {children}
      {actions !== undefined && actions !== null && <div {...stylex.props(headerStyles.trailing)}>{actions}</div>}
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
