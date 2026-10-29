import { MemoryChangeOutcome } from '@mechane/harness-tools';
import type { MemoryChange } from '@mechane/harness-tools';
import type { MechTables } from '@mechane/mech-store';
import { Match, Option } from 'effect';
import { decideMemoryDeletion } from './decide-memory-deletion.ts';
import { decideMemoryWrite } from './decide-memory-write.ts';

type DecideMemoryChangeInput = { readonly store: MechTables; readonly change: MemoryChange };

/**
 * Decides a memory tool call's change against the running turn's memory, in one transaction. A task that recorded its
 * change already answers from it, so pi's rerun after a restart answers the same; a refusal records nothing.
 */
export function decideMemoryChange({ store, change }: DecideMemoryChangeInput): MemoryChangeOutcome {
  const recorded = store.recordedChange({ taskId: change.taskId });

  if (Option.isSome(recorded)) {
    return Option.match(recorded.value.digest, {
      onNone: () => MemoryChangeOutcome.cases.Deleted.make({}),
      onSome: (digest) => MemoryChangeOutcome.cases.Saved.make({ digest }),
    });
  }

  const current = store.turnMemory({ path: change.path });

  return Match.valueTags(change, {
    Write: ({ taskId, path, text, digest, expectedDigest }) =>
      decideMemoryWrite({ store, current, taskId, path, text, digest, expectedDigest }),
    Delete: ({ taskId, path, expectedDigest }) =>
      decideMemoryDeletion({ store, current, taskId, path, expectedDigest }),
  });
}
