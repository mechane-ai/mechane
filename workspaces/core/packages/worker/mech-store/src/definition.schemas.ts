import { MECH_DEFINITION_FIELDS } from '@mechane/protocol';
import { renamedWireStruct } from '@mechane/records';

/** An immutable saved definition whose update time is stored as epoch milliseconds. */
export const MechRevisionRow = renamedWireStruct({
  fields: MECH_DEFINITION_FIELDS,
  renames: { updatedAt: 'updated_at_ms' },
});

export type MechRevisionRow = typeof MechRevisionRow.Type;
