import type { WatchId } from '@mechane/records';
import { FindingsAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { TablesInput } from '../types.ts';

type ReadFindingsInput = TablesInput & { readonly watchId: WatchId };

/** Reads current findings after checking that their mech and watch exist. */
export function readFindings({ store, watchId }: ReadFindingsInput): FindingsAnswer {
  const mech = store.mech();

  if (Option.isNone(mech)) {
    return FindingsAnswer.cases.MechMissing.make({});
  }

  const watch = store.watch({ watchId });

  if (Option.isNone(watch)) {
    return FindingsAnswer.cases.WatchMissing.make({});
  }

  const findings = store.findings({ watchId });

  return FindingsAnswer.cases.Listed.make({ findings });
}
