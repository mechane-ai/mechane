import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Harness, Tx } from '@earendil-works/pi-durable';
import type { InstalledWorkerWake, WithControl } from '../actor/types.ts';
import { ActiveNativeSessions, CallReceipts, Sessions } from './scheduler.ts';

const WORKER_RECHECK_MS = 30_000;
const LEASE_RECOVERY_RECHECK_MS = 1000;
type Demand = { readonly publicSessionId: string; readonly receiptKey: string; readonly nextCheckAt: number };

type ReconcileInput = {
  readonly harness: Harness;
  readonly withControl: WithControl;
  readonly wakeInstalledSession: InstalledWorkerWake;
  readonly workspaceId: string;
};

async function workerDemand(transaction: Tx): Promise<ReadonlyArray<Demand>> {
  const demand: Array<Demand> = [];

  for (const localId of await ActiveNativeSessions.allInTransaction(transaction)) {
    const state = await transaction.doc(Sessions, localId, null);

    if (!state.isArchived && state.waiting !== null) {
      const receiptKey = JSON.stringify([localId, state.waiting]);
      const call = await transaction.doc(CallReceipts, receiptKey, null);

      if (call.nativeKind === 'worker' && call.stage === 'result') {
        demand.push({ publicSessionId: state.publicSessionId, receiptKey, nextCheckAt: call.nextWorkerCheckAt ?? 0 });
      }
    }
  }

  return demand;
}

export async function reconcileWorkerDemand({
  harness,
  workspaceId,
  withControl,
  wakeInstalledSession,
}: ReconcileInput): Promise<number | null> {
  const now = Date.now();
  const demand = await harness.commit(workerDemand, BACKGROUND_CONTEXT);
  const deadlines: Array<number> = [];

  for (const item of demand) {
    if (item.nextCheckAt > now) {
      deadlines.push(item.nextCheckAt);
    } else {
      const scope = { workspaceId, sessionId: item.publicSessionId };

      const target = await withControl(async (store) => await store.managed.worker.ensureSessionWork(scope));

      let recheckMs = WORKER_RECHECK_MS;

      if (target !== null) {
        wakeInstalledSession(target);

        if (target.isRecoveringLease) {
          recheckMs = LEASE_RECOVERY_RECHECK_MS;
        }
      }

      const nextCheckAt = Date.now() + recheckMs;

      await harness.commit(async (transaction) => {
        const receipt = await transaction.doc(CallReceipts, item.receiptKey, null);
        receipt.nextWorkerCheckAt = nextCheckAt;
      }, BACKGROUND_CONTEXT);
      deadlines.push(nextCheckAt);
    }
  }

  if (deadlines.length === 0) {
    return null;
  }

  return Math.min(...deadlines);
}
