import { Button } from '@mechane-ai/elements';
import { AsyncRegion, EmptyState, Notice } from '@mechane-ai/elements/feedback';
import { canRetainResult, problemMessage } from '@mechane/console-data';
import type { ConsoleData, SnapshotCollection } from '@mechane/console-data';
import { useLiveQuery } from '@tanstack/react-db';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

type RefreshState =
  | { readonly kind: 'idle' | 'pending' }
  | { readonly kind: 'failed'; readonly problem: unknown; readonly retry: () => void; readonly isRetrying: boolean };

export type ResourceState<T> =
  | { readonly kind: 'pending' }
  | { readonly kind: 'failed'; readonly problem: unknown; readonly retry: () => void; readonly isRetrying: boolean }
  | { readonly kind: 'ready'; readonly value: T; readonly refresh: RefreshState };

/** The producer owns a collection; readers can observe it without canceling one another. */
export function useCollectionLifetime(
  data: ConsoleData,
  source: Parameters<ConsoleData['retain']>[0] | undefined,
): void {
  useEffect(() => {
    if (source === undefined) {
      return;
    }

    data.retain(source);

    return () => {
      void data.release(source);
    };
  }, [data, source]);
}

export function useResource<T>(data: ConsoleData, source: SnapshotCollection<T>): ResourceState<T> {
  const query = useLiveQuery({ query: (builder) => builder.from({ snapshot: source }), client: data.db });
  const subscribe = useCallback((onChange: () => void) => data.subscribeFetchStatus(source, onChange), [data, source]);
  const readStatus = useCallback(() => data.readFetchStatus(source), [data, source]);
  const fetchStatus = useSyncExternalStore(subscribe, readStatus, readStatus);
  const snapshot = query.data.find((candidate) => candidate.key === source.id) ?? source.get(source.id);
  const sourceFailure = source.health.error ?? source.health.failureReason;
  const queryFailure = query.health?.error ?? query.health?.failureReason;
  const failure = sourceFailure ?? queryFailure;
  const problem = failure?.cause;
  const hasFailed = source.health.hasErrors || query.health?.hasErrors === true;
  const canRetain = failure?.errors.every((error) => canRetainResult(error.cause)) ?? true;
  const isRefreshing = fetchStatus !== 'idle' || source.health.reloading || query.health?.reloading === true;

  function retry(): void {
    const hasLoadFailed = source.health.error !== null || (query.health?.error ?? null) !== null;
    const recovery = hasLoadFailed ? query.collection.reload() : source.utils.refetch();

    // Failed retries remain observable through the collection's health state.
    void Promise.allSettled([recovery]);
  }

  if (snapshot !== undefined && canRetain) {
    const refresh: RefreshState = hasFailed
      ? { kind: 'failed', problem, retry, isRetrying: isRefreshing }
      : { kind: isRefreshing ? 'pending' : 'idle' };

    return { kind: 'ready', value: snapshot.value, refresh };
  }

  return hasFailed ? { kind: 'failed', problem, retry, isRetrying: isRefreshing } : { kind: 'pending' };
}

type ResourceViewProps<T> = {
  readonly state: ResourceState<T>;
  readonly identity: string;
  readonly placeholder: ReactNode;
  readonly children: (value: T, notice: ReactNode) => ReactNode;
  readonly label?: string;
  readonly failure?: ReactNode;
};

export function ResourceView<T>({
  state,
  identity,
  placeholder,
  children,
  failure,
  label = 'Loading content',
}: ResourceViewProps<T>): ReactNode {
  switch (state.kind) {
    case 'ready':
      return (
        <AsyncRegion key={identity} state="ready" label={label} placeholder={placeholder}>
          {children(
            state.value,
            state.refresh.kind === 'failed' ? (
              <Notice hasError>
                Showing the last result. Refresh failed. {problemMessage(state.refresh.problem)}{' '}
                <Button onClick={state.refresh.retry} isPending={state.refresh.isRetrying} pendingLabel="Retrying…">
                  Retry refresh
                </Button>
              </Notice>
            ) : null,
          )}
        </AsyncRegion>
      );
    case 'failed':
      return (
        <AsyncRegion key={identity} state="failed" label={label} placeholder={placeholder}>
          {failure ?? (
            <div role="alert">
              <EmptyState
                title="Unable to load"
                action={
                  <Button onClick={state.retry} isPending={state.isRetrying} pendingLabel="Trying again…">
                    Try again
                  </Button>
                }
              >
                {problemMessage(state.problem)}
              </EmptyState>
            </div>
          )}
        </AsyncRegion>
      );
    case 'pending':
      return <AsyncRegion key={identity} state="pending" label={label} placeholder={placeholder} />;
  }
}

export function Resource<T>({
  data,
  source,
  ...presentation
}: { readonly data: ConsoleData; readonly source: SnapshotCollection<T> } & Omit<
  ResourceViewProps<T>,
  'state' | 'identity'
>): ReactNode {
  const state = useResource(data, source);

  return <ResourceView {...presentation} state={state} identity={source.id} />;
}
