import type { ControlStore } from '@mechane/control-store';
import { createManagedAgentRuntime } from '@mechane/runtime';
import type { ActorNamespace } from '@mechane/runtime';

type WorkRecovery = {
  readonly store: ControlStore;
  readonly actors: ActorNamespace;
  readonly environmentId: string;
  readonly workspaceId: string;
  readonly sessionId?: string;
};

const RECOVERY_BATCH_ROWS = 4;

export async function reconcileLostWork({ store, actors, ...scope }: WorkRecovery): Promise<void> {
  const lossStore = store.managed.worker.losses;
  const pending = await lossStore.pending({ ...scope, maxRows: RECOVERY_BATCH_ROWS });

  await Promise.all(
    pending.map(async (loss) => {
      const actor = createManagedAgentRuntime(actors, { workspaceId: loss.workspaceId, agentId: loss.agentId });

      await actor.loseWorkerLease({ sessionId: loss.sessionId, leaseId: loss.leaseId });
      await lossStore.clear(loss);
    }),
  );
}
