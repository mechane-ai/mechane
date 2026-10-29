import { MechUpdateAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { AlarmDecision, NowInput, TablesInput } from '../types.ts';
import { changedDefinition } from './changed-definition.ts';
import type { DefinitionChange } from './types.ts';

type UpdateDefinitionInput = TablesInput & NowInput & DefinitionChange;

/** Refuses stale revisions and saves accepted changes for activation when no turn or drone is running. */
export function updateDefinition({
  store,
  now,
  expectedRevision,
  ...change
}: UpdateDefinitionInput): AlarmDecision<MechUpdateAnswer> {
  const current = store.mech();

  if (Option.isNone(current)) {
    return { answer: MechUpdateAnswer.cases.MechMissing.make({}), isAlarmDue: false };
  }

  const mech = current.value;

  if (mech.revision !== expectedRevision) {
    const pending = store.pendingMechIndex();

    return {
      answer: MechUpdateAnswer.cases.Conflicting.make({ currentRevision: mech.revision }),
      isAlarmDue: Option.isSome(pending),
    };
  }

  const updated = changedDefinition({ mech, now, change: { ...change, expectedRevision } });

  store.updateMech({ mech: updated });

  return { answer: MechUpdateAnswer.cases.Updated.make({ mech: updated }), isAlarmDue: true };
}
