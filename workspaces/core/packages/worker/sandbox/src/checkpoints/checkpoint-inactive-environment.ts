import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { Option } from 'effect';

type InactiveEnvironmentInput = { readonly store: SandboxStore };

/** Only a matching frozen drain proves a stopped machine's final files; ordinary snapshots resume their writers. */
export function checkpointInactiveEnvironment({ store }: InactiveEnvironmentInput): FileCheckpointResult {
  const head = store.workspace().head;
  const previousMachine = store.latestReadyMachine();

  if (Option.isNone(previousMachine)) {
    return Option.match(head, {
      onNone: () => FileCheckpointResult.cases.Unallocated.make({}),
      onSome: ({ generation }) => FileCheckpointResult.cases.Committed.make({ generation }),
    });
  }

  const drain = store.machineDrain({ machineId: previousMachine.value.id });

  if (Option.isSome(head) && Option.isSome(drain)) {
    const purpose = FileCheckpointPurpose.cases.Drain.make(drain.value);
    const finalCheckpoint = store.fileCheckpointResult({ purpose });

    if (
      Option.isSome(finalCheckpoint) &&
      FileCheckpointResult.guards.Committed(finalCheckpoint.value) &&
      finalCheckpoint.value.generation === head.value.generation
    ) {
      return finalCheckpoint.value;
    }
  }

  return FileCheckpointResult.cases.Failed.make({
    reason:
      'The environment lost its machine without a matching final file checkpoint; restore and inspect it before continuing',
  });
}
