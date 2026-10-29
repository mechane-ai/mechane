import { applyMigrations, schemaRevision } from '@mechane/store';
import { droneEndRecords } from './drones/drone-end-records.ts';
import { droneRecords } from './drones/drone-records.ts';
import { eventRecords } from './events/event-records.ts';
import { findingRecords } from './findings/finding-records.ts';
import { copyRecords } from './forks/copy-records.ts';
import { forkRecords } from './forks/fork-records.ts';
import { inboxItemRecords } from './inbox/inbox-item-records.ts';
import { mechRecords } from './mechs/mech-records.ts';
import { memoryRecords } from './memories/memory-records.ts';
import { MIGRATIONS } from './migrations.ts';
import { slackDeliveryProgressRecords } from './slack/slack-delivery-progress-records.ts';
import { slackDeliveryRecords } from './slack/slack-delivery-records.ts';
import { slackOriginRecords } from './slack/slack-origin-records.ts';
import { sourceRecords } from './sources/source-records.ts';
import { threadRecords } from './threads/thread-records.ts';
import { turnEndRecords } from './turns/turn-end-records.ts';
import { turnRecords } from './turns/turn-records.ts';
import type { MechStore, MechTables, OpenMechStoreInput } from './types.ts';
import { watchRecords } from './watches/watch-records.ts';

/**
 * Opens a mech's own tables and applies, in one transaction, every migration their ledger does not record. Every
 * statement runs inside a transaction of the client the mech shares with pi, so none joins a pi transaction. A stored
 * row that fails to decode is a defect, since only this store writes the tables.
 */
export async function openMechStore({ storage, transaction }: OpenMechStoreInput): Promise<MechStore> {
  const { sql } = storage;

  const tables: MechTables = {
    schemaRevision: () => schemaRevision({ sql }),
    ...mechRecords({ sql }),
    ...inboxItemRecords({ sql }),
    ...slackDeliveryRecords({ sql }),
    ...slackOriginRecords({ sql }),
    ...slackDeliveryProgressRecords({ sql }),
    ...turnRecords({ sql }),
    ...turnEndRecords({ sql }),
    ...eventRecords({ sql }),
    ...watchRecords({ sql }),
    ...sourceRecords({ sql }),
    ...findingRecords({ sql }),
    ...memoryRecords({ sql }),
    ...threadRecords({ sql }),
    ...droneRecords({ sql }),
    ...droneEndRecords({ sql }),
    ...forkRecords({ sql }),
    ...copyRecords({ sql }),
  };

  await transaction({ run: () => applyMigrations({ sql, migrations: MIGRATIONS }) });

  const atomic: MechStore['atomic'] = ({ run }) => transaction({ run: () => run(tables) });

  return { atomic };
}
