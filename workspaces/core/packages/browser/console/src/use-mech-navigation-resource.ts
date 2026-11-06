import { canRetainResult } from '@mechane/console-data';
import type { Mech } from '@mechane/protocol';
import { useEffect } from 'react';
import { useNavigationPreferences } from './navigation-preferences.tsx';
import type { ResourceState } from './resource.tsx';

/** Records explicit visits and forgets a shortcut only after confirmed loss of access. */
export function useMechNavigationResource({
  state,
  mechId,
  shouldRecordVisit = false,
}: {
  readonly state: ResourceState<Mech>;
  readonly mechId: Mech['id'];
  /** Omission observes shortcut availability without adding a recent visit. */
  readonly shouldRecordVisit?: boolean;
}): void {
  const { visit, forget } = useNavigationPreferences();
  const isRemoved = state.kind === 'failed' && !canRetainResult(state.problem);
  const isAvailable = state.kind === 'ready';

  useEffect(() => {
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      if (isRemoved) {
        forget(mechId);
      } else if (shouldRecordVisit && isAvailable) {
        visit(mechId);
      }
    });

    return () => {
      isActive = false;
    };
  }, [forget, isAvailable, isRemoved, mechId, shouldRecordVisit, visit]);
}
