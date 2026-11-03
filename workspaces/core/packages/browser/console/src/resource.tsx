import { canRetainResult, problemMessage } from '@mechane/console-data';
import type { ConsoleData, SnapshotCollection } from '@mechane/console-data';
import { Button, EmptyState, Loading, Notice } from '@mechane/ui';
import { DetailPage } from '@mechane/ui-layout';
import { useLiveQuery } from '@tanstack/react-db';
import { Fragment, useEffect } from 'react';
import type { ReactNode } from 'react';

type ResourceState<T> =
  | { readonly kind: 'pending' }
  | { readonly kind: 'failed'; readonly problem: unknown; readonly retry: () => void }
  | { readonly kind: 'ready'; readonly value: T }
  | { readonly kind: 'stale'; readonly value: T; readonly problem: unknown; readonly retry: () => void };

export function useResource<T>(data: ConsoleData, source: SnapshotCollection<T>): ResourceState<T> {
  const query = useLiveQuery({ query: (q) => q.from({ snapshot: source }), client: data.db });

  useEffect(() => {
    data.retain(source);

    return () => {
      void data.release(source);
    };
  }, [data, source]);

  const snapshot = query.data.find((candidate) => candidate.key === source.id);

  const sourceFailure = source.health.error ?? source.health.failureReason;
  const queryFailure = query.health?.error ?? query.health?.failureReason;
  const failure = sourceFailure ?? queryFailure;

  const problem = failure?.cause;
  const failed = source.health.hasErrors || query.health?.hasErrors === true;
  const mayRetain = failure?.errors.every((error) => canRetainResult(error.cause)) ?? true;

  function retry(): void {
    const loadFailed = source.health.error !== null || (query.health?.error ?? null) !== null;
    const recovery = loadFailed ? query.collection.reload() : source.utils.refetch();

    // The health tree reports failed reloads to this view, without another error channel from the click.
    void Promise.allSettled([recovery]);
  }

  if (snapshot !== undefined && mayRetain) {
    return failed ? { kind: 'stale', value: snapshot.value, problem, retry } : { kind: 'ready', value: snapshot.value };
  }

  return failed ? { kind: 'failed', problem, retry } : { kind: 'pending' };
}

export function Resource<T>({
  data,
  source,
  children,
  fallbackHeader,
  label = 'Loading records',
}: {
  readonly data: ConsoleData;
  readonly source: SnapshotCollection<T>;
  readonly children: (value: T, notice: ReactNode) => ReactNode;
  readonly fallbackHeader?: ReactNode;
  readonly label?: string;
}): ReactNode {
  const state = useResource(data, source);

  switch (state.kind) {
    case 'ready':
    case 'stale':
      return (
        <Fragment key={source.id}>
          {children(
            state.value,
            state.kind === 'stale' ? (
              <Notice error>
                Showing the last result. Refresh failed. {problemMessage(state.problem)}{' '}
                <Button onClick={state.retry}>Retry refresh</Button>
              </Notice>
            ) : null,
          )}
        </Fragment>
      );
    case 'failed':
      return (
        <>
          {fallbackHeader}
          <div role="alert">
            <EmptyState title="Unable to load" action={<Button onClick={state.retry}>Try again</Button>}>
              {problemMessage(state.problem)}
            </EmptyState>
          </div>
        </>
      );
    case 'pending':
      return (
        <>
          {fallbackHeader}
          {fallbackHeader === undefined ? (
            <Loading label={label} />
          ) : (
            <DetailPage>
              <Loading label={label} shape="detail" />
            </DetailPage>
          )}
        </>
      );
  }
}
