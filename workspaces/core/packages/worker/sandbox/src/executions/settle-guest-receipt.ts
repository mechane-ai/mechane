import type { SettledReceipt } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import { beginCheckpoint } from '../checkpoints/begin-checkpoint.ts';
import type { DispatchedExecution, WorkspaceProviderStepInput } from '../types.ts';

type SettleGuestReceiptInput = Pick<WorkspaceProviderStepInput, 'store' | 'workspace'> & {
  readonly execution: DispatchedExecution;
  readonly receipt: SettledReceipt;
  readonly now: DateTime.Utc;
};

/** Saves the receipt directly or holds it behind the portable workspace checkpoint. */
export function settleGuestReceipt({ store, workspace, execution, receipt, now }: SettleGuestReceiptInput): void {
  const { id: executionId, machineId } = execution;

  if (Option.isSome(workspace)) {
    beginCheckpoint({ store, executionId, machineId, receipt, now });

    return;
  }

  store.settleExecution({ executionId, machineId, receipt, now });
}
