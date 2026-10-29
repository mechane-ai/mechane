import { SandboxAction, SandboxArchive, SandboxPhase } from '@mechane/protocol';
import { RecordText, RemoteSandboxId, SandboxOperationId } from '@mechane/records';
import { Schema } from 'effect';

/** The replacement is named before creation; a lost response can rediscover the same VM. */
export const SandboxMaintenance = Schema.Struct({
  id: SandboxOperationId,
  action: Schema.Enum(SandboxAction),
  phase: Schema.Enum(SandboxPhase),
  image: RecordText,
  sourceId: RecordText,
  /** Null before a replacement VM is discovered. */
  targetId: Schema.OptionFromNullOr(RemoteSandboxId),
  /** Null before the source archive is complete. */
  archive: Schema.OptionFromNullOr(Schema.toType(SandboxArchive)),
  part: Schema.Int,
});

export type SandboxMaintenance = typeof SandboxMaintenance.Type;
