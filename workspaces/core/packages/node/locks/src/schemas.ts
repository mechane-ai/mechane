import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';

const ReferenceFlag = Schema.Struct({ name: Schema.String, variable: Schema.optionalKey(Schema.String) });

/**
 * The parts of the command reference that ship as names: commands, their flags, global flags, variables, the exit
 * statuses and the codes of the CLI's own errors.
 */
export const ReferenceNames = wireStruct({
  fields: {
    flags: Schema.Array(ReferenceFlag),
    commands: Schema.Array(Schema.Struct({ name: Schema.String, flags: Schema.Array(ReferenceFlag) })),
    variables: Schema.Array(Schema.Struct({ name: Schema.String })),
    exitStatuses: Schema.Array(Schema.Struct({ name: Schema.String, status: Schema.Int })),
    errorCodes: Schema.Array(Schema.String),
  },
});

export type ReferenceNames = typeof ReferenceNames.Type;
