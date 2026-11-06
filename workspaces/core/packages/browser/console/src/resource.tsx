import { Button } from '@mechane-ai/elements';
import { AsyncRegion, EmptyState, Notice } from '@mechane-ai/elements/feedback';
import { problemMessage } from '@mechane/console-data';
import type { ReactNode } from 'react';

type RefreshState =
  | { readonly kind: 'idle' | 'pending' }
  | { readonly kind: 'failed'; readonly problem: unknown; readonly retry: () => void; readonly isRetrying: boolean };

export type ResourceState<T> =
  | { readonly kind: 'pending' }
  | { readonly kind: 'failed'; readonly problem: unknown; readonly retry: () => void; readonly isRetrying: boolean }
  | { readonly kind: 'ready'; readonly value: T; readonly refresh: RefreshState };

type ResourceViewProps<T> = {
  readonly state: ResourceState<T>;
  readonly placeholder: ReactNode;
  readonly children: (value: T, notice: ReactNode) => ReactNode;
  readonly label?: string;
  readonly failure?: ReactNode;
};

export function ResourceView<T>({
  state,
  placeholder,
  children,
  failure,
  label = 'Loading content',
}: ResourceViewProps<T>): ReactNode {
  switch (state.kind) {
    case 'ready':
      return (
        <AsyncRegion state="ready" label={label} placeholder={placeholder}>
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
        <AsyncRegion state="failed" label={label} placeholder={placeholder}>
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
      return <AsyncRegion state="pending" label={label} placeholder={placeholder} />;
  }
}
