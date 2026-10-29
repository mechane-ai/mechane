import type { MechTables } from '@mechane/mech-store';
import { SourceGrantAnswer } from '@mechane/rpc';
import { Option } from 'effect';

type ReadSourceGrantInput = Pick<MechTables, 'mech' | 'sourceGrant'>;

/** Checking existence and reading the grant share one transaction without advancing source work. */
export function readSourceGrant({ mech: readMech, sourceGrant }: ReadSourceGrantInput): SourceGrantAnswer {
  const mech = readMech();

  if (Option.isNone(mech)) {
    return SourceGrantAnswer.cases.MechMissing.make({});
  }

  const grant = sourceGrant();

  return SourceGrantAnswer.cases.Found.make({ state: { grant } });
}
