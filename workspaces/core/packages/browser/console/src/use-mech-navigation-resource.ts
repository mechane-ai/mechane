import { canRetainResult } from '@mechane/console-data';
import type { SnapshotCollection } from '@mechane/console-data';
import type { Mech } from '@mechane/protocol';
import { useEffect } from 'react';
import { useNavigationPreferences } from './navigation-preferences.tsx';

/** Navigation changes follow protected resource settlement and stop when its screen leaves. */
export function useMechNavigationResource({
  source,
  mechId,
  shouldRecordVisit = false,
}: {
  readonly source: SnapshotCollection<Mech>;
  readonly mechId: Mech['id'];
  /** An absent value keeps this resource lookup out of Recents. */
  readonly shouldRecordVisit?: boolean;
}): void {
  const { visit, forget } = useNavigationPreferences();

  useEffect(() => {
    let isActive = true;

    function onResourceChange(): void {
      if (!isActive) {
        return;
      }

      const failure = source.health.error ?? source.health.failureReason;

      if (failure !== null && !canRetainResult(failure.cause)) {
        forget(mechId);

        return;
      }

      if (shouldRecordVisit && source.get(source.id) !== undefined) {
        visit(mechId);
      }
    }

    const changes = source.subscribeChanges(onResourceChange, { includeInitialState: false });
    const unsubscribeHealth = source.on('health:change', onResourceChange);

    void source.preload().then(onResourceChange, onResourceChange);

    return () => {
      isActive = false;

      unsubscribeHealth();
      changes.unsubscribe();
    };
  }, [forget, mechId, shouldRecordVisit, source, visit]);
}
