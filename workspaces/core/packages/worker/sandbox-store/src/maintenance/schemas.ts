import { SandboxAction, SandboxArchive, SandboxPhase } from '@mechane/protocol';
import { RecordId, RecordText, SandboxOperationId } from '@mechane/records';
import { Schema } from 'effect';
import { WorkspaceSnapshot } from '../workspaces/schemas.ts';

/** The resumable candidate and preserved source survive Worker eviction independently. */
export const PortableMaintenance = Schema.Struct({
  id: SandboxOperationId,
  action: Schema.Enum(SandboxAction),
  phase: Schema.Enum(SandboxPhase),
  provider: RecordText,
  generation: RecordId,
  /** Absent when the workspace has no portable snapshot yet. */
  source: Schema.OptionFromNullOr(WorkspaceSnapshot),
  /** Absent until export checkpointing completes, or when deleting. */
  archive: Schema.OptionFromNullOr(Schema.toType(SandboxArchive)),
  /** Absent before replacement machine creation. */
  target: Schema.OptionFromNullOr(RecordId),
  part: Schema.Int,
});

export type PortableMaintenance = typeof PortableMaintenance.Type;
