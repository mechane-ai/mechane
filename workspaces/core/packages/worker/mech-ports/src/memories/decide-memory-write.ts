import { MemoryChangeOutcome } from '@mechane/harness-tools';
import type { MemoryRefusal } from '@mechane/harness-tools';
import type { MechTables, TurnMemoryRow } from '@mechane/mech-store';
import { MEMORIES_PER_MECH } from '@mechane/protocol';
import { Option } from 'effect';
import { changeRefusal } from './change-refusal.ts';

/** A write a memory tool call asks for, and the memory it finds at its path. */
type DecideMemoryWriteInput = {
  readonly store: MechTables;
  /** Absent when no memory is at the write's path. */
  readonly current: Option.Option<TurnMemoryRow>;
  readonly taskId: number;
  readonly path: string;
  readonly text: string;
  readonly digest: string;
  /** Absent for a create, which replaces no memory. */
  readonly expectedDigest: Option.Option<string>;
};

/** The memory a write finds at its path, and the digest the write names. */
type WriteRefusalInput = Pick<DecideMemoryWriteInput, 'store' | 'current' | 'expectedDigest'>;

/**
 * Decides a write of the running turn's memory: a create finds no memory at its path and room for one more, and a
 * replacement names the current memory's digest. A write the memory allows is recorded and answers its digest.
 */
export function decideMemoryWrite({
  store,
  current,
  taskId,
  path,
  text,
  digest,
  expectedDigest,
}: DecideMemoryWriteInput): MemoryChangeOutcome {
  const refusal = writeRefusal({ store, current, expectedDigest });

  if (Option.isSome(refusal)) {
    return refusal.value;
  }

  store.recordMemoryWrite({ taskId, path, text, digest });

  return MemoryChangeOutcome.cases.Saved.make({ digest });
}

/** Why a write is refused: a create meets a memory at its path or the limit, a replacement a changed memory. */
function writeRefusal({ store, current, expectedDigest }: WriteRefusalInput): Option.Option<MemoryRefusal> {
  if (Option.isSome(expectedDigest)) {
    return changeRefusal({ current, expectedDigest: expectedDigest.value });
  }

  if (Option.isSome(current)) {
    return Option.some(MemoryChangeOutcome.cases.Exists.make({}));
  }

  if (store.turnMemoryCount() >= MEMORIES_PER_MECH) {
    return Option.some(MemoryChangeOutcome.cases.Full.make({}));
  }

  return Option.none();
}
