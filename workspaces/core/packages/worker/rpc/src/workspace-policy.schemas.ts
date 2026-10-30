import { MachinesVariable, WORKER_VARIABLES } from '@mechane/deployment';
import { WorkspacePolicy } from '@mechane/protocol';
import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** Installation ceilings bound every policy; the sandbox default applies only while no policy is stored. */
export const WorkspaceVariables = renamedWireStruct({
  fields: {
    isSandboxEnabled: Schema.fromJsonString(Schema.Boolean),
    isWorkspaceSandboxEnabledByDefault: Schema.fromJsonString(Schema.Boolean),
    workspaceMachines: MachinesVariable,
    workspaceDailyAllowanceLimitMicros: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  },
  renames: {
    isSandboxEnabled: WORKER_VARIABLES.isSandboxEnabled,
    isWorkspaceSandboxEnabledByDefault: WORKER_VARIABLES.isWorkspaceSandboxEnabledByDefault,
    workspaceMachines: WORKER_VARIABLES.workspaceMachines,
    workspaceDailyAllowanceLimitMicros: WORKER_VARIABLES.workspaceDailyAllowanceLimitMicros,
  },
});

export type WorkspaceVariables = typeof WorkspaceVariables.Type;

/** Whether an explicit runtime policy exists, independently of the effective installation defaults. */
export const WorkspacePresence = Schema.Struct({ isPresent: Schema.Boolean });
export type WorkspacePresence = typeof WorkspacePresence.Type;

/** A policy is saved only within installation ceilings and the caller's create-only condition. */
export const WorkspacePolicyMutation = Schema.TaggedUnion({
  Saved: { policy: WorkspacePolicy },
  AlreadyExists: {},
  LimitsExceeded: {},
});

export type WorkspacePolicyMutation = typeof WorkspacePolicyMutation.Type;
