import { TextLink } from '@mechane-ai/elements';
import {
  createLink,
  useElementScrollRestoration,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import type { HistoryState } from '@tanstack/react-router';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { ConsoleLocation, PageCursors, ReaderPosition } from './types.ts';

const RouteLink = createLink(TextLink);

/** Reads the router's history position with an identity that cannot carry another owner's offset. */
export function useReaderPosition(scope: string, resource: string) {
  const id = `reader:${encodeURIComponent(scope)}:${encodeURIComponent(resource)}`;
  const entry = useElementScrollRestoration({ id });

  const position = useMemo(
    () => (entry === undefined ? undefined : { region: id, top: entry.scrollY, left: entry.scrollX }),
    [entry, id],
  );

  return { id, position };
}

/** One transition policy preserves a run's origin and clears reader state when its owner changes. */
export function consoleTransition(from: ConsoleLocation, to: ConsoleLocation) {
  const isSameMech = from.mech !== undefined && from.mech === to.mech;
  const implicitWorkspace = isSameMech ? (from.workspace ?? to.workspace) : undefined;
  const fromWorkspace = from.workspace ?? implicitWorkspace;
  const toWorkspace = to.workspace ?? implicitWorkspace;
  const hasSameOwner = fromWorkspace === toWorkspace && from.mech === to.mech;
  const isSameTurn = from.turn !== undefined && from.turn === to.turn;
  const isWithinRun = hasSameOwner && isSameTurn;
  const isSameEventScope = isWithinRun && from.event === to.event;

  return {
    replace: isWithinRun,
    resetScroll: !hasSameOwner,
    state: (prior: HistoryState): HistoryState => {
      const retained: HistoryState = hasSameOwner ? prior : {};

      const state =
        isSameEventScope || retained.consolePages === undefined
          ? retained
          : { ...retained, consolePages: { ...retained.consolePages, events: [] } };

      return to.turn === undefined || isWithinRun ? state : { ...state, consoleRunOrigin: from };
    },
  };
}

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
      const transition = consoleTransition(location, search);

      if (!transition.replace) {
        globalThis.history.replaceState({ ...entry, consoleReturn: { row, positions: readReaderPositions() } }, '');
      }

      void navigate({ to: '/', search, ...transition });
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
  const transition = consoleTransition(location, to);

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
      {...transition}
      onClick={(event) => {
        onClick?.(event);

        const hasCommandModifier = event.metaKey || event.ctrlKey;
        const hasAlternateModifier = event.shiftKey || event.altKey;
        const isCurrentTab = props.target === undefined || props.target === '_self';

        if (row === undefined || event.button !== 0 || event.defaultPrevented) {
          return;
        }

        if (hasCommandModifier || hasAlternateModifier || !isCurrentTab) {
          return;
        }

        if (transition.replace) {
          return;
        }

        globalThis.history.replaceState({ ...entry, consoleReturn: { row, positions: readReaderPositions() } }, '');
      }}
    >
      {children}
    </RouteLink>
  );
}

export function turnEventCursor(pages: PageCursors['events'] | undefined, target: number | undefined): number {
  return pages?.at(-1) ?? (target === undefined ? 0 : target - 1);
}

/** Cursors belong to a history entry. Back restores its page after the protected collection is mounted again. */
export function usePageCursors<K extends keyof PageCursors>(
  key: K,
  initial: PageCursors[K],
): readonly [PageCursors[K], (next: PageCursors[K]) => void] {
  const navigate = useNavigate({ from: '/' });
  const pages = useRouterState({ select: (state) => state.location.state.consolePages });
  const cursors = pages?.[key] ?? initial;

  const setCursors = useCallback(
    (next: PageCursors[K]) => {
      void navigate({
        to: '/',
        search: true,
        replace: true,
        resetScroll: false,
        state: (prior) => ({ ...prior, consolePages: { ...prior.consolePages, [key]: next } }),
      });
    },
    [key, navigate],
  );

  return [cursors, setCursors];
}
