import { MemoryChangeOutcome } from '@mechane/harness-tools';
import type { MechTables, TurnMemoryRow } from '@mechane/mech-store';
import { Option } from 'effect';
import { changeRefusal } from './change-refusal.ts';

/** A deletion a memory tool call asks for, and the memory it finds at its path. */
type DecideMemoryDeletionInput = {
  readonly store: MechTables;
  /** Absent when no memory is at the deletion's path. */
  readonly current: Option.Option<TurnMemoryRow>;
  readonly taskId: number;
  readonly path: string;
  readonly expectedDigest: string;
};

/** Decides a deletion of the running turn's memory, which names the current memory's digest, and records it. */
export function decideMemoryDeletion({
  store,
  current,
  taskId,
  path,
  expectedDigest,
}: DecideMemoryDeletionInput): MemoryChangeOutcome {
  const refusal = changeRefusal({ current, expectedDigest });

  if (Option.isSome(refusal)) {
    return refusal.value;
  }

  store.recordMemoryDeletion({ taskId, path });

  return MemoryChangeOutcome.cases.Deleted.make({});
}
