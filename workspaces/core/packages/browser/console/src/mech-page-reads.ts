import { canRetainResult } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { TurnId } from '@mechane/records';
import { Option, Schema } from 'effect';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { usePageSource } from './page-source.tsx';
import type { PageSource } from './page-source.tsx';
import { useCollectionLifetime } from './resource.tsx';
import type { ConsoleLocation } from './types.ts';

type MechViewRead =
  | { readonly view: 'conversation' | 'definition' }
  | { readonly view: 'runs'; readonly pageSource: PageSource<'turns', ReturnType<ConsoleData['turns']>> }
  | { readonly view: 'work'; readonly pageSource: PageSource<'work', ReturnType<ConsoleData['threads']>> }
  | { readonly view: 'memory'; readonly source: ReturnType<ConsoleData['memories']> }
  | { readonly view: 'activity'; readonly pageSource: PageSource<'activity', ReturnType<ConsoleData['events']>> };

type PrimarySource = Parameters<ConsoleData['retain']>[0] & {
  readonly id: ReturnType<ConsoleData['events']>['id'];
  readonly health: ReturnType<ConsoleData['events']>['health'];
  readonly get: (key: string) => unknown;
  readonly preload: () => Promise<void>;
  readonly subscribeChanges: (
    notify: () => void,
    options: { readonly includeInitialState: boolean },
  ) => { readonly unsubscribe: () => void };
  readonly on: (event: 'health:change', notify: () => void) => () => void;
};

type ReadStatus = 'pending' | 'failed' | 'failed-retrying' | 'ready';

function sourceStatus(data: ConsoleData, source: PrimarySource | undefined): ReadStatus {
  if (source === undefined) {
    return 'ready';
  }

  const failure = source.health.error ?? source.health.failureReason;
  const snapshot = source.get(source.id);
  const canRetain = failure?.errors.every((error) => canRetainResult(error.cause)) ?? true;

  if (source.health.hasErrors && (snapshot === undefined || !canRetain)) {
    const isRetrying = source.health.reloading || data.readFetchStatus(source) !== 'idle';

    return isRetrying ? 'failed-retrying' : 'failed';
  }

  return snapshot === undefined ? 'pending' : 'ready';
}

function usePrimaryStatus(data: ConsoleData, source: PrimarySource | undefined): ReadStatus {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (source === undefined) {
        return () => undefined;
      }

      let isActive = true;

      function changed(): void {
        if (isActive) {
          notify();
        }
      }

      const changes = source.subscribeChanges(changed, { includeInitialState: false });
      const health = source.on('health:change', changed);
      const fetch = data.subscribeFetchStatus(source, changed);

      void source.preload().then(changed, changed);

      return () => {
        isActive = false;

        changes.unsubscribe();
        health();
        fetch();
      };
    },
    [data, source],
  );

  return useSyncExternalStore(
    subscribe,
    () => sourceStatus(data, source),
    () => 'pending',
  );
}

/** The page preloads its primary view without transferring collection ownership to its readers. */
export function useMechPageReads(data: ConsoleData, mechId: string, location: ConsoleLocation) {
  const requestedView = location.view ?? 'conversation';

  const conversation = usePageSource({
    data,
    key: 'conversation',
    scope: mechId,
    create: (cursors) => data.events(mechId, cursors.at(-1) ?? null),
  });

  const turns = usePageSource({
    data,
    key: 'turns',
    scope: mechId,
    isEnabled: requestedView === 'runs',
    create: (cursors) => data.turns(mechId, Option.fromNullishOr(cursors.at(-1))),
  });

  const work = usePageSource({
    data,
    key: 'work',
    scope: mechId,
    isEnabled: requestedView === 'work',
    create: (cursors) => data.threads(mechId, Option.fromNullishOr(cursors.at(-1))),
  });

  const activity = usePageSource({
    data,
    key: 'activity',
    scope: mechId,
    isEnabled: requestedView === 'activity',
    create: (cursors) => data.events(mechId, cursors.at(-1) ?? null),
  });

  const memory = useMemo(
    () => (requestedView === 'memory' ? data.memories(mechId) : undefined),
    [data, mechId, requestedView],
  );

  function readView(): MechViewRead {
    if (turns !== undefined) {
      return { view: 'runs', pageSource: turns };
    }

    if (work !== undefined) {
      return { view: 'work', pageSource: work };
    }

    if (activity !== undefined) {
      return { view: 'activity', pageSource: activity };
    }

    if (memory !== undefined) {
      return { view: 'memory', source: memory };
    }

    return { view: requestedView === 'definition' ? 'definition' : 'conversation' };
  }

  const viewRead = readView();

  const turnId = location.turn;

  const trace = useMemo(
    () => (Schema.is(TurnId)(turnId) ? data.trace(mechId, turnId) : undefined),
    [data, mechId, turnId],
  );

  const viewSource = 'pageSource' in viewRead ? viewRead.pageSource.source : memory;
  const primary = turnId === undefined ? (viewRead.view === 'conversation' ? conversation.source : viewSource) : trace;

  useCollectionLifetime(data, memory);
  useCollectionLifetime(data, trace);

  const status = usePrimaryStatus(data, primary);

  return { conversation, viewRead, trace, primary, status };
}

/** These borrowed sources remain owned by the mech page while its readers mount and unmount. */
export type MechPageReads = ReturnType<typeof useMechPageReads>;
