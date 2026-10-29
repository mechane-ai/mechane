import type { MechRow } from '@mechane/mech-store';
import { MechStatus } from '@mechane/protocol';
import { Micros, PrincipalId } from '@mechane/records';
import type { CreateMechInput } from '@mechane/rpc';
import { Option } from 'effect';
import type { AlarmDecision, NowInput, TablesInput } from '../types.ts';

type CreateDefinitionInput = TablesInput & NowInput & { readonly input: CreateMechInput };

/** Creates the first active definition once; retries return the existing mech and preserve any pending roster wake. */
export function createDefinition({ store, input, now }: CreateDefinitionInput): AlarmDecision<MechRow> {
  const existing = store.mech();

  if (Option.isSome(existing)) {
    const pending = store.pendingMechIndex();

    return { answer: existing.value, isAlarmDue: Option.isSome(pending) };
  }

  const { mechId, instructions, dailyCapMicros, ...fields } = input;

  const mech: MechRow = {
    id: mechId,
    ...fields,
    instructions: Option.fromNullishOr(instructions),
    dailyCapMicros: Micros.make(dailyCapMicros),
    createdAt: now,
    forkedFrom: Option.none(),
    revision: 1,
    activeRevision: 1,
    status: MechStatus.Active,
    updatedAt: now,
    updaterId: PrincipalId.make(fields.creatorId),
  };

  store.createMech({ mech });

  return { answer: mech, isAlarmDue: true };
}
