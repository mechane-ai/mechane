import { canRetainResult, problemMessage } from '@mechane/console-data';
import type { ConsoleData, SnapshotCollection } from '@mechane/console-data';
import { Button, EmptyState, Notice } from '@mechane/ui';
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
  const problem = source.health.error?.cause;
  const failed = query.health?.hasErrors === true;

  return { value: snapshot !== undefined && canRetainResult(problem) ? snapshot.value : undefined, problem, failed };
}

export function Resource<T>({
  data,
  source,
  children,
  fallbackHeader,
}: {
  readonly data: ConsoleData;
  readonly source: SnapshotCollection<T>;
  readonly children: (value: T, notice: ReactNode) => ReactNode;
  readonly fallbackHeader?: ReactNode;
}): ReactNode {
  const { value, problem, failed } = useResource(data, source);

  if (value !== undefined) {
    return children(
      value,
      failed ? (
        <Notice error>
          Refresh failed. Showing the last saved result.{' '}
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
      <EmptyState title="Loading…">Reading from your Mechane installation.</EmptyState>
    </>
  );
}
