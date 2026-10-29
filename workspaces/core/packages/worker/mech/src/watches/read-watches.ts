import { WatchesAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { TablesInput } from '../types.ts';

/** Returns the saved schedules or a missing-mech decision. */
export function readWatches({ store }: TablesInput): WatchesAnswer {
  const mech = store.mech();

  if (Option.isNone(mech)) {
    return WatchesAnswer.cases.MechMissing.make({});
  }

  const watches = store.watches();

  return WatchesAnswer.cases.Listed.make({ watches });
}
