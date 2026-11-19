import { recoverDelegateWorkerLeases } from './delegation/worker-loss.ts';
import type { ManagedAgentEngine } from './engine.ts';
import { recoverLocalWorkerLease } from './local-worker-loss.ts';
import type { ManagedWorkerLease } from './protocol.ts';

export async function recoverManagedWorkerLease(engine: ManagedAgentEngine, input: ManagedWorkerLease): Promise<void> {
  await recoverLocalWorkerLease(engine, input);
  await recoverDelegateWorkerLeases(engine, input);
}
