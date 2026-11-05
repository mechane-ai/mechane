import { TextLink } from '@mechane-ai/elements';
import { createLink, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { ConsoleLocation, PageCursors, ReaderPosition } from './types.ts';

const RouteLink = createLink(TextLink);

export function readReaderPositions(): ReadonlyArray<ReaderPosition> {
  return [...document.querySelectorAll<HTMLElement>('[data-scroll-restoration-id]')]
    .filter((element) => element.checkVisibility({ visibilityProperty: true }))
    .map((element) => ({
      region: element.dataset['scrollRestorationId'] ?? '',
      top: element.scrollTop,
      left: element.scrollLeft,
    }));
}

export function restoreReaderPositions(positions: ReadonlyArray<ReaderPosition>): void {
  for (const position of positions) {
    const element = document.querySelector<HTMLElement>(
      `[data-scroll-restoration-id="${CSS.escape(position.region)}"]`,
    );

    if (element?.checkVisibility({ visibilityProperty: true }) === true) {
      element.scrollTo({ top: position.top, left: position.left, behavior: 'instant' });
    }
  }
}

export function useRecordNavigation() {
  const router = useRouter();
  const navigate = useNavigate({ from: '/' });
  const entry = useRouterState({ select: (state) => state.location.state });
  const selectedTurn = useRouterState({ select: (state) => state.location.search.turn });
  const location = useRouterState({ select: (state) => state.location.search });

  const consumeReturn = useCallback(() => {
    void navigate({
      to: '/',
      search: true,
      replace: true,
      resetScroll: false,
      state: (prior) => {
        const rest = { ...prior };

        delete rest.consoleReturn;

        return rest;
      },
    });
  }, [navigate]);

  return {
    consumeReturn,
    focusRowId: selectedTurn === undefined ? entry.consoleReturn?.row : undefined,
    href: (search: ConsoleLocation) => router.buildLocation({ to: '/', search }).publicHref,
    open: (search: ConsoleLocation, row: string) => {
      globalThis.history.replaceState({ ...entry, consoleReturn: { row, positions: readReaderPositions() } }, '');
      void navigate({
        to: '/',
        search,
        resetScroll: false,
        state: (prior) => ({ ...prior, consoleRunOrigin: location }),
      });
    },
    back: (fallback: ConsoleLocation) => {
      if (entry.consoleRunOrigin !== undefined) {
        router.history.back();

        return;
      }

      void navigate({ to: '/', search: fallback, resetScroll: false, replace: true });
    },
  };
}

export function ConsoleLink({
  to,
  row,
  title,
  children,
  onClick,
  ...props
}: { readonly to: ConsoleLocation; readonly row?: string; readonly title?: string } & Omit<
  ComponentProps<'a'>,
  'href'
>): ReactNode {
  const anchor = useRef<HTMLAnchorElement>(null);
  const forwardedRef = props.ref;
  const entry = useRouterState({ select: (state) => state.location.state });
  const selectedTurn = useRouterState({ select: (state) => state.location.search.turn });
  const location = useRouterState({ select: (state) => state.location.search });

  useLayoutEffect(() => {
    if (selectedTurn !== undefined) {
      return;
    }

    const target = entry.consoleReturn;

    if (target === undefined || target.row !== row || anchor.current === null) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      anchor.current?.focus({ preventScroll: true });
      restoreReaderPositions(target.positions);
    });

    return () => cancelAnimationFrame(frame);
  }, [entry, row, selectedTurn]);

  return (
    <RouteLink
      {...props}
      ref={(element) => {
        anchor.current = element;

        if (typeof forwardedRef === 'function') {
          return forwardedRef(element);
        }

        if (forwardedRef !== undefined && forwardedRef !== null) {
          forwardedRef.current = element;
        }
      }}
      to="/"
      search={to}
      title={title}
      target={props.target ?? '_self'}
      resetScroll={false}
      state={(prior) => (to.turn === undefined ? prior : { ...prior, consoleRunOrigin: location })}
      onClick={(event) => {
        onClick?.(event);

        const command = event.metaKey || event.ctrlKey;
        const alternate = event.shiftKey || event.altKey;

        if (row === undefined || event.button !== 0 || event.defaultPrevented) {
          return;
        }

        if (command || alternate) {
          return;
        }

        globalThis.history.replaceState({ ...entry, consoleReturn: { row, positions: readReaderPositions() } }, '');
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
