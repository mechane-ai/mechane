import type { ItemProgressReport } from '@mechane/harness';
import type { MechRow, MechTables, PendingItemRow, RunningDroneRow } from '@mechane/mech-store';
import { DateTime, Option } from 'effect';
import { readOwedNotes } from '../turns/read-owed-notes.ts';
import type { OpenedMech } from '../types.ts';
import { advanceWatches } from '../watches/advance-watches.ts';
import { isWatchDeliveryReady } from '../watches/is-watch-delivery-ready.ts';
import { droneWork } from './drone-work.ts';
import { nextDeliveries } from './next-deliveries.ts';
import type { CaughtUp } from './types.ts';

/** What a catch-up reads the items and pi's progress from, and what it projects that progress with. */
type CatchUpInput = Pick<OpenedMech, 'store' | 'harness' | 'project'>;

/**
 * What a catch-up reads of the mech's own tables: the mech, the items pi may still move, the running drones, and the
 * ended drones whose machines run on.
 */
type PendingWork = {
  /** None before the object holds a mech. */
  readonly mech: Option.Option<MechRow>;
  readonly pending: ReadonlyArray<PendingItemRow>;
  readonly drones: ReadonlyArray<RunningDroneRow>;
  readonly unstopped: ReadonlyArray<string>;
};

type ReadCaughtInput = PendingWork & { readonly store: MechTables; readonly report: ItemProgressReport };

/**
 * Projects what pi holds of every pending item and running drone, which a lost instance may have left unprojected. It
 * answers what the alarm owes pi: notes for canceled and faulted turns, aborts and starts of drones, the items pi never
 * admitted, and the machines to stop. The projection is queued before any delivery and before the notes are read: no
 * dispatch reads an unprojected turn, and a turn it faults is owed its note at once.
 */
export async function catchUp({ store, harness, project }: CatchUpInput): Promise<CaughtUp> {
  const readPending: (tables: MechTables) => PendingWork = (tables) => ({
    mech: tables.mech(),
    pending: tables.pendingInboxItems(),
    drones: tables.runningDrones(),
    unstopped: tables.unstoppedDrones(),
  });

  const work = await store.atomic({ run: readPending });

  const inboxItemIds = work.pending.map(({ id }) => id);
  const droneIds = work.drones.map(({ id }) => id);
  const report = await harness.progress({ inboxItemIds, droneIds });

  project({ changes: report.changes, droneEnds: report.droneEnds });

  return await store.atomic({ run: (tables) => readCaught({ store: tables, ...work, report }) });
}

function readCaught({ store, mech, pending, drones, unstopped, report }: ReadCaughtInput): CaughtUp {
  const now = DateTime.nowUnsafe();

  advanceWatches({ store, now });

  const examinedIds = pending.map(({ id }) => id);
  const examined = new Set(examinedIds);

  const isReady: (pendingItem: PendingItemRow) => boolean = (pendingItem) =>
    isWatchDeliveryReady({ store, pending: pendingItem });

  const isMissing: (pendingItem: PendingItemRow) => boolean = ({ id }) =>
    !examined.has(id) || report.missing.includes(id);

  const missing = store.pendingInboxItems().filter(isMissing).filter(isReady);
  const notes = readOwedNotes({ store });
  const deliveries = nextDeliveries({ store, pending: missing });

  const withActive: (current: MechRow) => MechRow = (current) => {
    const definition = store.activeDefinition();

    return { ...current, ...definition };
  };

  const active = Option.map(mech, withActive);
  const pendingIndex = store.pendingMechIndex();

  return {
    isIndexDue: Option.isSome(pendingIndex),
    notes,
    deliveries,
    ...droneWork({ mech: active, drones, report, unstopped }),
  };
}
