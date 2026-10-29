import { DroneId, RecordText, RemoteSandboxId, SandboxOperationId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { SandboxAction, SandboxPhase } from './constants.ts';

/** A maintenance id makes retries resume the same operation; null selects inspection only. */
export const SandboxRequest = wireStruct({
  fields: {
    action: Schema.Enum(SandboxAction),
    /** Null for inspection; changes carry the id used by every retry. */
    operationId: Schema.OptionFromNullOr(SandboxOperationId),
    /** None selects the mech workspace. */
    droneId: Schema.OptionFromNullOr(DroneId),
    part: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  },
});

export type SandboxRequest = typeof SandboxRequest.Type;

/** The archive checksum covers the concatenation of every downloaded part. */
export const SandboxArchive = wireStruct({
  fields: {
    bytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    parts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  },
});

export type SandboxArchive = typeof SandboxArchive.Type;

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
    /** Null until an archive is complete and verified. */
    archive: Schema.OptionFromNullOr(SandboxArchive),
    part: Schema.Int,
    /** Null except in a successful archive-part download. */
    base64: Schema.OptionFromNullOr(RecordText),
  },
});

export type SandboxReport = typeof SandboxReport.Type;
