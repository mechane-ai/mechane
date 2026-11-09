import type { ConsoleMessagePage } from '@mechane/protocol';
import { MechId, WorkspaceId } from '@mechane/records';
import type { Sequence } from '@mechane/records';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { Duration, Option } from 'effect';
import { createApi } from './api.ts';

export type ConversationHistory = ConsoleMessagePage;

type ConversationTarget = {
  readonly mechId: string;
  readonly beforeSequence?: Sequence;
  readonly afterSequence?: Sequence;
};

type ConversationObservation = {
  readonly afterSequence: () => Sequence | undefined;
  readonly onPending: () => void;
  readonly onHistory: (history: ConversationHistory) => void;
  readonly onFailure: (problem: unknown) => void;
};

type CreateConversationApi = {
  readonly origin: URL;
  readonly workspaceId: string;
  readonly signal: AbortSignal;
  readonly onAccessLost: () => void;
};

/** Public conversation reads survive cache recovery but end when workspace admission ends. */
export function createConversationApi({ origin, workspaceId, signal, onAccessLost }: CreateConversationApi) {
  const api = createApi(origin, signal, onAccessLost);
  const queries = new QueryClient();

  queries.mount();
  signal.addEventListener(
    'abort',
    () => {
      queries.clear();
      queries.unmount();
    },
    { once: true },
  );

  async function history(target: ConversationTarget, lifetime: AbortSignal): Promise<ConversationHistory> {
    return await api(
      'listConsoleMessages',
      {
        workspaceId: WorkspaceId.make(workspaceId),
        mechId: MechId.make(target.mechId),
        beforeSequence: Option.fromUndefinedOr(target.beforeSequence),
        afterSequence: Option.fromUndefinedOr(target.afterSequence),
      },
      AbortSignal.any([signal, lifetime]),
    );
  }

  return {
    signal,
    history,
    observe(mechId: string, observation: ConversationObservation, lifetime: AbortSignal) {
      const observer = new QueryObserver(queries, {
        queryKey: ['console-conversation', workspaceId, mechId],
        queryFn: async ({ signal: readSignal }) => {
          const combined = AbortSignal.any([signal, lifetime, readSignal]);

          observation.onPending();

          try {
            const afterSequence = observation.afterSequence();

            const target = afterSequence === undefined ? { mechId } : { mechId, afterSequence };
            const result = await history(target, combined);

            combined.throwIfAborted();
            observation.onHistory(result);

            return true;
          } catch (problem) {
            if (!combined.aborted) {
              observation.onFailure(problem);
            }

            throw problem;
          }
        },
        retry: false,
        refetchInterval: Duration.toMillis('2 seconds'),
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        gcTime: 0,
      });

      const unsubscribe = observer.subscribe(() => undefined);

      return {
        async refresh(): Promise<void> {
          await observer.refetch();
        },
        dispose() {
          unsubscribe();
          observer.destroy();
        },
      };
    },
  };
}
