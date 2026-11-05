import { Button } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { canRetainResult, problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { useRouterState } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePageCursors } from './navigation.tsx';
import { useCollectionLifetime } from './resource.tsx';
import type { PageCursors } from './types.ts';

type PageCollection = Parameters<ConsoleData['retain']>[0] &
  Pick<ReturnType<ConsoleData['events']>, 'health' | 'on' | 'preload'>;

type PreparedPage<K extends keyof PageCursors, S extends PageCollection> = {
  readonly data: ConsoleData;
  readonly scope: string;
  readonly cursors: PageCursors[K];
  readonly source: S;
};

type PageRequest<K extends keyof PageCursors, S extends PageCollection> =
  | {
      readonly kind: 'pending';
      readonly page: PreparedPage<K, S>;
      readonly href: string;
      readonly failure: { readonly problem: unknown } | undefined;
    }
  | { readonly kind: 'failed'; readonly cursors: PageCursors[K]; readonly problem: unknown; readonly href: string };

type PageFailure = { readonly problem: unknown; readonly retry: () => void; readonly isRetrying: boolean };

/** One committed cursor/source pair, with a separate pending pagination intent. */
export type PageSource<K extends keyof PageCursors, S extends PageCollection> = {
  readonly source: S;
  readonly cursors: PageCursors[K];
  readonly setCursors: (next: PageCursors[K]) => void;
  readonly cancel: () => void;
  readonly pending: 'previous' | 'next' | undefined;
  readonly failure: PageFailure | undefined;
};

type PageSourceOptions<K extends keyof PageCursors, S extends PageCollection> = {
  readonly data: ConsoleData;
  readonly key: K;
  readonly scope: string;
  readonly create: (cursors: PageCursors[K]) => S;
};

function sameCursors(left: ReadonlyArray<string | number>, right: ReadonlyArray<string | number>): boolean {
  return left.length === right.length && left.every((cursor, index) => cursor === right[index]);
}

function mayRetainPage(source: PageCollection): boolean {
  const failure = source.health.error ?? source.health.failureReason;

  return failure?.errors.every((error) => canRetainResult(error.cause)) ?? true;
}

/** Prepare the exact next collection before committing its cursor; the current page stays readable meanwhile. */
export function usePageSource<K extends keyof PageCursors, S extends PageCollection>(
  options: PageSourceOptions<K, S>,
): PageSource<K, S>;
export function usePageSource<K extends keyof PageCursors, S extends PageCollection>(
  options: PageSourceOptions<K, S> & { readonly isEnabled: boolean },
): PageSource<K, S> | undefined;
export function usePageSource<K extends keyof PageCursors, S extends PageCollection>({
  data,
  key,
  scope,
  create,
  isEnabled = true,
}: PageSourceOptions<K, S> & { readonly isEnabled?: boolean }): PageSource<K, S> | undefined {
  const [cursors, commitCursors] = usePageCursors(key, []);
  const href = useRouterState({ select: (state) => state.location.href });

  const [saved, setSaved] = useState<PreparedPage<K, S> | undefined>(() =>
    isEnabled ? { data, scope, cursors, source: create(cursors) } : undefined,
  );

  const [request, setRequest] = useState<PageRequest<K, S>>();
  const pending = useRef<PreparedPage<K, S> | undefined>(undefined);
  const activeSource = useRef<S | undefined>(saved?.source);
  let page = saved;

  if (request !== undefined && request.href !== href) {
    setRequest(undefined);
  }

  if (!isEnabled && saved !== undefined) {
    page = undefined;

    setSaved(undefined);
    setRequest(undefined);
  }

  const hasSameOwner = saved?.data === data && saved.scope === scope;
  const isSamePage = saved !== undefined && sameCursors(saved.cursors, cursors);

  if (isEnabled && (!hasSameOwner || !isSamePage)) {
    const prepared = request?.kind === 'pending' ? request.page : undefined;
    const hasMatchingPreparedOwner = prepared?.data === data && prepared.scope === scope;
    const hasMatchingPreparedCursors = prepared !== undefined && sameCursors(prepared.cursors, cursors);

    page =
      hasMatchingPreparedOwner && hasMatchingPreparedCursors
        ? prepared
        : { data, scope, cursors, source: create(cursors) };

    setSaved(page);
    setRequest(undefined);
  }

  const source = page?.source;

  useLayoutEffect(() => {
    activeSource.current = source;
    pending.current = request?.kind === 'pending' ? request.page : undefined;
  }, [request, source]);

  useCollectionLifetime(data, source);

  useEffect(() => {
    if (request?.kind !== 'pending') {
      return;
    }

    const candidate = request.page;
    let isActive = true;

    data.retain(candidate.source);

    const unsubscribe = source?.on('health:change', () => {
      if (isActive && !mayRetainPage(source)) {
        pending.current = undefined;

        setRequest(undefined);
      }
    });

    void candidate.source.preload().then(
      () => {
        if (isActive && pending.current === candidate) {
          commitCursors(candidate.cursors);
        }
      },
      (cause: unknown) => {
        if (!isActive || pending.current !== candidate) {
          return;
        }

        const health = candidate.source.health.error ?? candidate.source.health.failureReason;
        const problem = health?.cause ?? cause;

        if (mayRetainPage(candidate.source)) {
          setRequest({ kind: 'failed', cursors: candidate.cursors, problem, href: request.href });
        } else {
          commitCursors(candidate.cursors);
        }
      },
    );

    return () => {
      isActive = false;

      unsubscribe?.();

      // Adoption transfers this collection to the committed page's lifetime owner.
      if (activeSource.current !== candidate.source) {
        void data.release(candidate.source);
      }
    };
  }, [commitCursors, data, request, source]);

  function setCursors(next: PageCursors[K]): void {
    if (!isEnabled || pending.current !== undefined || sameCursors(cursors, next)) {
      return;
    }

    const candidate = { data, scope, cursors: next, source: create(next) };

    const failure =
      request?.kind === 'failed' && sameCursors(request.cursors, next) ? { problem: request.problem } : undefined;

    pending.current = candidate;

    setRequest({ kind: 'pending', page: candidate, href, failure });
  }

  if (page === undefined) {
    return undefined;
  }

  let failure: PageFailure | undefined = undefined;

  if (request?.kind === 'failed') {
    failure = { problem: request.problem, retry: () => setCursors(request.cursors), isRetrying: false };
  } else if (request?.kind === 'pending' && request.failure !== undefined) {
    failure = { problem: request.failure.problem, retry: () => setCursors(request.page.cursors), isRetrying: true };
  }

  return {
    source: page.source,
    cursors: page.cursors,
    setCursors,
    cancel: () => {
      pending.current = undefined;

      setRequest(undefined);
    },
    pending:
      request?.kind === 'pending'
        ? request.page.cursors.length > page.cursors.length
          ? 'next'
          : 'previous'
        : undefined,
    failure,
  };
}

/** Pagination failure belongs beside its controls while the current page remains readable. */
export function PageLoadNotice({ failure }: { readonly failure: PageFailure | undefined }): ReactNode {
  return failure === undefined ? null : (
    <Notice hasError>
      Could not load this page. {problemMessage(failure.problem)}{' '}
      <Button isPending={failure.isRetrying} pendingLabel="Retrying…" onClick={failure.retry}>
        Try again
      </Button>
    </Notice>
  );
}
