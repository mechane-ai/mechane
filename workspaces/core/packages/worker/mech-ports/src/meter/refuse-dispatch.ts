import type { Reservation } from '@mechane/harness';
import { writeLog } from '@mechane/logs';
import type { DispatchWork, MechStore, MechTables } from '@mechane/mech-store';
import { LogEvent } from '@mechane/protocol';
import type { DispatchRequest } from '@mechane/records';
import { DateTime, Match } from 'effect';

/** A refused dispatch of the workspace, and its turn or drone, on which the allowance's refusal is recorded. */
type RefuseDispatchInput = {
  readonly store: MechStore;
  readonly workspaceId: string;
  readonly dispatch: DispatchRequest;
  readonly work: DispatchWork;
};

/**
 * Records a refusal on the dispatch's turn or drone in one transaction, since its projection reads it to tell why the
 * work ended. It logs the refusal by its ids, and answers it.
 */
export async function refuseDispatch({
  store,
  workspaceId,
  dispatch,
  work,
}: RefuseDispatchInput): Promise<Reservation> {
  const { id: dispatchId, mechId, requestedMicros } = dispatch;
  const now = DateTime.nowUnsafe();

  const refuse: (tables: MechTables) => void = (tables) => {
    Match.valueTags(work, {
      Turn: ({ id }) => tables.refuseTurn({ turnId: id, now }),
      Drone: ({ id }) => tables.refuseDrone({ droneId: id, now }),
    });
    writeLog({ line: { event: LogEvent.DispatchRefused, workspaceId, mechId, dispatchId, requestedMicros } });
  };

  await store.atomic({ run: refuse });

  return { _tag: 'Refused' };
}
