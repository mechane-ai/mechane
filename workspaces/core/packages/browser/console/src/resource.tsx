import { canRetainResult, problemMessage } from '@mechane/console-data';
import type { ConsoleData, SnapshotCollection } from '@mechane/console-data';
import { Button, DetailPage, EmptyState, Loading, Notice } from '@mechane/ui';
import { useLiveQuery } from '@tanstack/react-db';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function useResource<T>(data: ConsoleData, source: SnapshotCollection<T>) {
  const query = useLiveQuery({ query: (q) => q.from({ snapshot: source }), client: data.db });

  useEffect(() => {
    data.retain(source);

    return () => {
      void data.release(source);
    };
  }, [data, source]);

  const snapshot = query.data[0];
  const failure = source.health.error ?? source.health.failureReason;
  const problem = failure?.cause;
  const failed = query.health?.hasErrors === true;

  return { value: snapshot !== undefined && canRetainResult(problem) ? snapshot.value : undefined, problem, failed };
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
  const { value, problem, failed } = useResource(data, source);

  if (value !== undefined) {
    return children(
      value,
      failed ? (
        <Notice error>
          Showing the last result. Refresh failed.{' '}
          <Button
            onClick={() => {
              void source.utils.refetch();
            }}
          >
            Retry refresh
          </Button>
        </Notice>
      ) : null,
    );
  }

  if (failed) {
    return (
      <>
        {fallbackHeader}
        <div role="alert">
          <EmptyState
            title="Unable to load"
            action={
              <Button
                onClick={() => {
                  void source.utils.refetch();
                }}
              >
                Try again
              </Button>
            }
          >
            {problemMessage(problem)}
          </EmptyState>
        </div>
      </>
    );
  }

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
