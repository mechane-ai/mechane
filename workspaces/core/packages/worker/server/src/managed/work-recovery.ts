import type { SlotNamespace } from '@mechane/agent-slot';
import type { ControlStore } from '@mechane/control-store';
import { createManagedAgentRuntime } from '@mechane/runtime';

type WorkRecovery = {
  readonly store: ControlStore;
  readonly sessions: Pick<SlotNamespace, 'getByName'>;
  readonly environmentId: string;
  readonly workspaceId: string;
  readonly sessionId?: string;
};

const RECOVERY_BATCH_ROWS = 4;

export async function reconcileLostWork({ store, sessions, ...scope }: WorkRecovery): Promise<void> {
  const lossStore = store.managed.worker.losses;
  const pending = await lossStore.pending({ ...scope, maxRows: RECOVERY_BATCH_ROWS });

  await Promise.all(
    pending.map(async (loss) => {
      const actor = createManagedAgentRuntime(sessions, { workspaceId: loss.workspaceId, agentId: loss.agentId });

      await actor.loseWorkerLease({ sessionId: loss.sessionId, leaseId: loss.leaseId });
      await lossStore.clear(loss);
    }),
  );
}
