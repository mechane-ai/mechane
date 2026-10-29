import type { MechRow } from '@mechane/mech-store';
import { Option } from 'effect';
import type { NowInput } from '../types.ts';
import type { DefinitionChange } from './types.ts';

type ChangedDefinitionInput = NowInput & { readonly mech: MechRow; readonly change: DefinitionChange };

/** Builds the next saved revision, preserving omitted fields and the revision pinned by running work. */
export function changedDefinition({ mech, change, now }: ChangedDefinitionInput): MechRow {
  const name = Option.fromUndefinedOr(change.name);
  const model = Option.fromUndefinedOr(change.model);
  const instructions = Option.fromUndefinedOr(change.instructions);
  const dailyCapMicros = Option.fromUndefinedOr(change.dailyCapMicros);
  const status = Option.fromUndefinedOr(change.status);

  return {
    ...mech,
    name: Option.getOrElse(name, () => mech.name),
    model: Option.getOrElse(model, () => mech.model),
    instructions: Option.getOrElse(instructions, () => mech.instructions),
    dailyCapMicros: Option.getOrElse(dailyCapMicros, () => mech.dailyCapMicros),
    status: Option.getOrElse(status, () => mech.status),
    revision: mech.revision + 1,
    updatedAt: now,
    updaterId: change.updaterId,
  };
}
