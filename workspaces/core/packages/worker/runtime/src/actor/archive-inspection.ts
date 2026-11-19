import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Session, Storage } from '@earendil-works/pi-durable';
import type { ActorMaintenance, ActorStatus, MechScope } from './client.ts';
import { PendingCancellations, PendingEffects } from './collections.ts';
import type { ActorState } from './state.ts';

const TASK_PAGE_ROWS = 100;
const pendingStatuses = ['pending', 'running', 'waiting', 'sleeping', 'completing'] as const;

export function archiveStatus(scope: MechScope, state: ActorState | undefined): ActorStatus {
  return {
    ...scope,
    activeRevision: state?.activeRevision ?? 1,
    turnId: null,
    status: 'quiesced',
    admittedSequence: state?.notificationBaseSequence ?? 0,
    observedSequence: state?.observedSequence ?? 0,
  };
}

async function countStoredTasks(records: Storage, status: (typeof pendingStatuses)[number]): Promise<number> {
  let count = 0;
  const position: { cursor?: Parameters<Storage['scanTasks']>[2] } = {};

  do {
    const page = await records.scanTasks({ status }, TASK_PAGE_ROWS, position.cursor, BACKGROUND_CONTEXT);
    count += page.items.length;
    position.cursor = page.next;
  } while (position.cursor !== undefined);

  return count;
}

export async function inspectArchive({
  scope,
  state,
  session,
  records,
}: {
  readonly scope: MechScope;
  readonly state: ActorState | undefined;
  readonly session: Session;
  readonly records: Storage;
}): Promise<ActorMaintenance> {
  let pendingNativeTaskCount = 0;

  for (const status of pendingStatuses) {
    pendingNativeTaskCount += await countStoredTasks(records, status);
  }

  return {
    ...archiveStatus(scope, state),
    pendingNativeTaskCount,
    pendingEffectCount: (await PendingEffects.count(session)) + (await PendingCancellations.count(session)),
    isCheckpointRequired: state?.isEnvironmentCheckpointRequired ?? false,
    isImportComplete: state?.isImportComplete ?? true,
    canResume: false,
  };
}
