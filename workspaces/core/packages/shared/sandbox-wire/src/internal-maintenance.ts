import { BYTES_PER_KIBIBYTE, RecordText, RemoteSandboxId, SandboxOperationId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { SandboxEnvironmentState } from './environment-state.ts';

/** Maintenance is explicit; inspecting a sandbox never wakes it. */
export const SandboxAction = { Show: 'show', Upgrade: 'upgrade', Delete: 'delete', Cancel: 'cancel' } as const;

export type SandboxAction = (typeof SandboxAction)[keyof typeof SandboxAction];

/** Maintenance holds new executions until it finishes, fails, or is canceled. */
export const SandboxPhase = {
  Idle: 'idle',
  Quiesce: 'quiesce',
  Create: 'create',
  Restore: 'restore',
  Commit: 'commit',
  Retire: 'retire',
  Done: 'done',
  Failed: 'failed',
} as const;

export type SandboxPhase = (typeof SandboxPhase)[keyof typeof SandboxPhase];

/** A maintenance id makes retries resume the same operation; null selects inspection only. */
export const SandboxRequest = wireStruct({
  fields: {
    action: Schema.Enum(SandboxAction),
    /** Null for inspection; changes carry the id used by every retry. */
    operationId: Schema.OptionFromNullOr(SandboxOperationId),
  },
});

export type SandboxRequest = typeof SandboxRequest.Type;

/** Provider identifiers are observable, while provider credentials remain inside the service. */
export const SandboxReport = wireStruct({
  fields: {
    provider: RecordText,
    /** Null before any provider VM is bound or after explicit deletion. */
    sandboxId: Schema.OptionFromNullOr(RemoteSandboxId),
    status: RecordText,
    /** Null when the provider no longer reports a VM. */
    image: Schema.OptionFromNullOr(RecordText),
    desiredImage: RecordText,
    /** Null before the first maintenance request. */
    operationId: Schema.OptionFromNullOr(SandboxOperationId),
    /** Null before the first maintenance request. */
    action: Schema.OptionFromNullOr(Schema.Enum(SandboxAction)),
    phase: Schema.Enum(SandboxPhase),
    lastError: Schema.OptionFromNullOr(RecordText),
    environment: SandboxEnvironmentState,
  },
});

export type SandboxReport = typeof SandboxReport.Type;

/** A verified filesystem archive stored as bounded R2 parts. */
export const SandboxArchive = wireStruct({
  fields: {
    bytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    parts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  },
});

export type SandboxArchive = typeof SandboxArchive.Type;

export const SANDBOX_ARCHIVE_PART_BYTES = 1024 * BYTES_PER_KIBIBYTE;
