import { Micros, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** Workspace policy changes independently of deployment and remains bounded by installation limits. */
export const WorkspacePolicy = wireStruct({
  fields: {
    isSuspended: Schema.Boolean,
    hasSandboxes: Schema.Boolean,
    machines: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    dailyAllowanceMicros: Micros,
  },
});

export type WorkspacePolicy = typeof WorkspacePolicy.Type;
