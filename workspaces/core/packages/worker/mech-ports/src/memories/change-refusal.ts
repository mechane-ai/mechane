import { MemoryChangeOutcome } from '@mechane/harness-tools';
import type { MemoryRefusal } from '@mechane/harness-tools';
import type { TurnMemoryRow } from '@mechane/mech-store';
import { Option } from 'effect';

/** The memory a change of an existing memory finds at its path, and the digest the change names. */
type ChangeRefusalInput = {
  /** Absent when no memory is at the change's path. */
  readonly current: Option.Option<TurnMemoryRow>;
  readonly expectedDigest: string;
};

/** Why a change of an existing memory is refused: no memory is at its path, or the memory there has another digest. */
export function changeRefusal({ current, expectedDigest }: ChangeRefusalInput): Option.Option<MemoryRefusal> {
  if (Option.isNone(current)) {
    return Option.some(MemoryChangeOutcome.cases.Missing.make({}));
  }

  if (current.value.digest !== expectedDigest) {
    return Option.some(MemoryChangeOutcome.cases.Changed.make({}));
  }

  return Option.none();
}
