import { Button } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { canRetainResult, problemMessage } from '@mechane/console-data';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePageCursors } from './navigation.tsx';
import type { PageCursors } from './types.ts';

type PageIntent<Key extends keyof PageCursors, Request extends ReadRequest> = {
  readonly data: ConsoleData;
  readonly scope: string;
  readonly cursors: PageCursors[Key];
  readonly request: Request;
  readonly href: string;
  readonly isPending: boolean;
  readonly failure: { readonly problem: unknown } | undefined;
};

type PageFailure = { readonly problem: unknown; readonly retry: () => void; readonly isRetrying: boolean };

export type PageRead<Key extends keyof PageCursors, Request extends ReadRequest> = {
  readonly request: Request;
  readonly cursors: PageCursors[Key];
  readonly setCursors: (next: PageCursors[Key]) => void;
  readonly cancel: () => void;
  readonly pending: 'previous' | 'next' | undefined;
  readonly failure: PageFailure | undefined;
};

type PageReadOptions<Key extends keyof PageCursors, Request extends ReadRequest> = {
  readonly data: ConsoleData;
  readonly key: Key;
  readonly scope: string;
  readonly create: (cursors: PageCursors[Key]) => Request;
};

function sameCursors(left: ReadonlyArray<string | number>, right: ReadonlyArray<string | number>): boolean {
  return left.length === right.length && left.every((cursor, index) => cursor === right[index]);
}

export function usePageRead<Key extends keyof PageCursors, Request extends ReadRequest>(
  options: PageReadOptions<Key, Request>,
): PageRead<Key, Request>;
export function usePageRead<Key extends keyof PageCursors, Request extends ReadRequest>(
  options: PageReadOptions<Key, Request> & { readonly isEnabled: boolean },
): PageRead<Key, Request> | undefined;
export function usePageRead<Key extends keyof PageCursors, Request extends ReadRequest>({
  data,
  key,
  scope,
  create,
  isEnabled = true,
}: PageReadOptions<Key, Request> & { readonly isEnabled?: boolean }): PageRead<Key, Request> | undefined {
  const [cursors, commitCursors] = usePageCursors(key, []);
  const href = useRouterState({ select: (state) => state.location.href });
  const [intent, setIntent] = useState<PageIntent<Key, Request>>();
  const pending = useRef<PageIntent<Key, Request> | undefined>(undefined);
  const hasMatchingOwner = intent?.data === data && intent.scope === scope && intent.href === href;
  const hasCommitted = intent !== undefined && sameCursors(intent.cursors, cursors);
  const activeIntent = hasMatchingOwner && !hasCommitted && isEnabled ? intent : undefined;

  if (intent !== undefined && activeIntent === undefined) {
    pending.current = undefined;

    setIntent(undefined);
  }

  useEffect(() => {
    if (activeIntent?.isPending !== true) {
      return;
    }

    const controller = new AbortController();
    const candidate = activeIntent;

    void data.ready(candidate.request, controller.signal).then(
      () => {
        if (!controller.signal.aborted && pending.current === candidate) {
          commitCursors(candidate.cursors);
        }
      },
      (problem: unknown) => {
        if (controller.signal.aborted || pending.current !== candidate) {
          return;
        }

        pending.current = undefined;

        if (canRetainResult(problem)) {
          setIntent({ ...candidate, isPending: false, failure: { problem } });
        } else {
          commitCursors(candidate.cursors);
        }
      },
    );

    return () => controller.abort();
  }, [activeIntent, commitCursors, data]);

  function setCursors(next: PageCursors[Key]): void {
    if (!isEnabled || pending.current !== undefined || sameCursors(cursors, next)) {
      return;
    }

    const failure =
      activeIntent !== undefined && sameCursors(activeIntent.cursors, next) ? activeIntent.failure : undefined;

    const candidate = { data, scope, cursors: next, request: create(next), href, isPending: true, failure };

    pending.current = candidate;

    setIntent(candidate);
  }

  if (!isEnabled) {
    return undefined;
  }

  return {
    request: create(cursors),
    cursors,
    setCursors,
    cancel: () => {
      pending.current = undefined;

      setIntent(undefined);
    },
    pending:
      activeIntent?.isPending === true
        ? activeIntent.cursors.length > cursors.length
          ? 'next'
          : 'previous'
        : undefined,
    failure:
      activeIntent?.failure === undefined
        ? undefined
        : {
            problem: activeIntent.failure.problem,
            retry: () => setCursors(activeIntent.cursors),
            isRetrying: activeIntent.isPending,
          },
  };
}

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
