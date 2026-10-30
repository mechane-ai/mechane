import { WorkspacePolicy } from '@mechane/protocol';
import { Schema } from 'effect';

/** The stored document retains the requested policy before installation ceilings are applied. */
export const PolicyRow = Schema.Struct({ policy: Schema.fromJsonString(WorkspacePolicy) });

export type PolicyRow = typeof PolicyRow.Type;
