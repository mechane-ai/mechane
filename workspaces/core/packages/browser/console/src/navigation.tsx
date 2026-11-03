import { TextLink } from '@mechane/ui';
import { createLink, useNavigate, useRouterState } from '@tanstack/react-router';
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ConsoleLocation, PageCursors } from './types.ts';

const RouteLink = createLink(TextLink);

export function ConsoleLink({
  to,
  row,
  title,
  children,
}: {
  readonly to: ConsoleLocation;
  readonly row?: string;
  readonly title?: string;
  readonly children: ReactNode;
}): ReactNode {
  const anchor = useRef<HTMLAnchorElement>(null);
  const entry = useRouterState({ select: (state) => state.location.state });

  useLayoutEffect(() => {
    const target = entry.consoleReturn;

    if (target === undefined || target.row !== row || anchor.current === null) {
      return;
    }

    anchor.current.focus({ preventScroll: true });
    globalThis.scrollTo({ top: target.scrollTop, behavior: 'instant' });
  }, [entry, row]);

  return (
    <RouteLink
      ref={anchor}
      to="/"
      search={to}
      title={title}
      onClick={(event) => {
        const command = event.metaKey || event.ctrlKey;
        const alternate = event.shiftKey || event.altKey;

        if (row === undefined || event.button !== 0) {
          return;
        }

        if (command || alternate) {
          return;
        }

        globalThis.history.replaceState({ ...entry, consoleReturn: { row, scrollTop: globalThis.scrollY } }, '');
      }}
    >
      {children}
    </RouteLink>
  );
}

/** Cursors belong to a history entry. Back restores its page after the protected collection is mounted again. */
export function usePageCursors<K extends keyof PageCursors>(
  key: K,
  initial: PageCursors[K],
): readonly [PageCursors[K], (next: PageCursors[K]) => void] {
  const navigate = useNavigate({ from: '/' });
  const pages = useRouterState({ select: (state) => state.location.state.consolePages });
  const cursors = pages?.[key] ?? initial;

  return [
    cursors,
    (next) => {
      void navigate({
        to: '/',
        search: true,
        replace: true,
        resetScroll: false,
        state: (prior) => ({ ...prior, consolePages: { ...prior.consolePages, [key]: next } }),
      });
    },
  ];
}
