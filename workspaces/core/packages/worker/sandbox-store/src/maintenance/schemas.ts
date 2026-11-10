import { MachineId, RecordText, SandboxOperationId } from '@mechane/records';
import { SandboxAction, SandboxPhase } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { WorkspaceSnapshot } from '../workspaces/schemas.ts';

export const PortableMaintenance = Schema.Struct({
  id: SandboxOperationId,
  action: Schema.Enum(SandboxAction),
  phase: Schema.Enum(SandboxPhase),
  provider: RecordText,
  source: Schema.OptionFromNullOr(WorkspaceSnapshot),
  target: Schema.OptionFromNullOr(MachineId),
  lastError: Schema.OptionFromOptionalKey(RecordText),
});

export type PortableMaintenance = typeof PortableMaintenance.Type;
