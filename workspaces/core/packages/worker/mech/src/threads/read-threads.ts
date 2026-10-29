import { ThreadsAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { PageInput } from '../types.ts';

/** A page of the mech's threads, oldest first, read in one transaction. */
export function readThreads({ store, after }: PageInput): ThreadsAnswer {
  return Option.match(store.mech(), {
    onNone: () => ThreadsAnswer.cases.MechMissing.make({}),
    onSome: () => store.threads({ after }),
  });
}
