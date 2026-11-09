import type { QueryClient } from '@tanstack/query-core';
import { MutableRef } from 'effect';

type ReadCounts = { readonly active: number; readonly refreshing: number; readonly failed: number };

/** Derived network counts contain no request keys, record values, or failure payloads. */
export function createReadDiagnostics(client: QueryClient) {
  const cache = client.getQueryCache();
  const snapshot = MutableRef.make<ReadCounts>({ active: 0, refreshing: 0, failed: 0 });

  return {
    subscribe: (notify: () => void) => cache.subscribe(notify),
    read(this: void) {
      const reads = cache.getAll();

      const next = {
        active: reads.filter((query) => query.getObserversCount() > 0).length,
        refreshing: reads.filter((query) => query.state.fetchStatus === 'fetching').length,
        failed: reads.filter((query) => query.state.error !== null).length,
      };

      if (Object.entries(next).some(([key, value]) => Reflect.get(snapshot.current, key) !== value)) {
        snapshot.current = next;
      }

      return snapshot.current;
    },
  };
}
