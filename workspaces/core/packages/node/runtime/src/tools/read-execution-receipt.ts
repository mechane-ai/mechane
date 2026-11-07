import type { ExecutionReceipt } from '../domain.ts';
import type { RuntimeStore } from '../store/database.ts';
import type { RuntimeToolContext } from './types.ts';

type ReceiptLookup = Pick<RuntimeToolContext, 'workspaceId' | 'mechId'> & {
  readonly store: RuntimeStore;
  readonly executionId: string;
  readonly kind: ExecutionReceipt['kind'];
};

/** An observer may read only its mech's receipt of the expected native tool kind. */
export async function readExecutionReceipt({
  store,
  workspaceId,
  mechId,
  executionId,
  kind,
}: ReceiptLookup): Promise<ExecutionReceipt | null> {
  const receipt = await store.getExecution({ id: executionId, workspaceId, mechId });

  if (receipt === null || receipt.kind !== kind) {
    return null;
  }

  return receipt;
}
