import { RecordId } from '@mechane/records';
import type { SandboxStore } from '@mechane/sandbox-store';
import type { ExecutionId, SettledReceipt } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import type { MachineIdInput } from '../types.ts';

type BeginCheckpointInput = {
  readonly store: SandboxStore;
  readonly machineId: MachineIdInput['machineId'];
  readonly executionId: ExecutionId;
  readonly receipt: SettledReceipt;
  readonly now: DateTime.Utc;
};

/** Records the settled receipt and its next workspace generation before archiving begins. */
export function beginCheckpoint({ store, machineId, executionId, receipt, now }: BeginCheckpointInput): void {
  const state = store.workspace();
  const parent = Option.map(state.head, ({ generation }) => generation);

  const generation = RecordId.make(crypto.randomUUID());
  const archive = Option.none();

  store.saveCheckpoint({ generation, parent, machineId, executionId, receipt, startedAt: now, archive, part: 0 });
}
