import { MemoriesAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { TablesInput } from '../types.ts';

/** The memories the mech's turns saved, by path, read in one transaction. */
export function readMemories({ store }: TablesInput): MemoriesAnswer {
  if (Option.isNone(store.mech())) {
    return MemoriesAnswer.cases.MechMissing.make({});
  }

  return MemoriesAnswer.cases.Listed.make({ memories: store.savedMemories({ throughVersion: Option.none() }) });
}
