import { DronesAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { PageInput } from '../types.ts';

/** A page of the mech's drones, oldest first, read in one transaction. */
export function readDrones({ store, after }: PageInput): DronesAnswer {
  return Option.match(store.mech(), {
    onNone: () => DronesAnswer.cases.MechMissing.make({}),
    onSome: () => store.drones({ after }),
  });
}
