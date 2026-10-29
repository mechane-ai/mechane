import type { MechSummary } from '@mechane/protocol';
import { DateTime, Option } from 'effect';

type MechLineInput = { readonly mech: MechSummary };

/** One mech as a person reads it: its id, name and model, when it was created, and the mech it was forked from. */
export function mechLine({ mech }: MechLineInput): string {
  const created = `${mech.id} ${mech.name} (${mech.model}) ${mech.status} revision ${mech.revision} created at ${DateTime.formatIso(mech.createdAt)}`;
  const { forkedFrom } = mech;

  if (Option.isNone(forkedFrom)) {
    return created;
  }

  return `${created}, forked from ${forkedFrom.value.mechId} after #${forkedFrom.value.sequence}`;
}
