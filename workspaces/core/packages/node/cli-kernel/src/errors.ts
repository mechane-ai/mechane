import { OperationFailed } from '@mechane/client';
import { OutputMode } from '@mechane/commands';
import { FileStep } from '@mechane/program';
import { CliTarget, Release } from '@mechane/protocol';
import { Bytes } from '@mechane/records';
import { Schema } from 'effect';
import { CredentialsStep } from './constants.ts';

/** The downloaded binary holds another number of bytes than its release's manifest names. */
export class SizeMismatched extends Schema.TaggedError<SizeMismatched>()('SizeMismatched', {
  release: Release,
  bytes: Bytes,
  manifestBytes: Bytes,
}) {}

/** The downloaded binary's SHA-256 differs from the one its release's manifest names. */
export class DigestMismatched extends Schema.TaggedError<DigestMismatched>()('DigestMismatched', {
  release: Release,
  sha256: Schema.String,
  manifestSha256: Schema.String,
}) {}

/** The new binary does not run here. */
export class BinaryUnrunnable extends Schema.TaggedError<BinaryUnrunnable>()('BinaryUnrunnable', {
  reason: Schema.String,
}) {}

/** The new binary reports another release than its own, `release`. */
export class ReleaseMisreported extends Schema.TaggedError<ReleaseMisreported>()('ReleaseMisreported', {
  release: Release,
  reported: Schema.String,
}) {}

/** The program is no release's binary, such as a run from source, so no release replaces it. */
export class ReleaseStampMissing extends Schema.TaggedError<ReleaseStampMissing>()('ReleaseStampMissing', {
  release: Release,
  installScriptUrl: Schema.URL,
}) {}

/** The deployment's latest release publishes no binary for the target this CLI was built for. */
export class TargetUnpublished extends Schema.TaggedError<TargetUnpublished>()('TargetUnpublished', {
  release: Release,
  target: Schema.Enum(CliTarget),
}) {}

/** The binary the deployment served at `url` is not its release's, as `mismatch` says. */
export class BinaryMismatched extends Schema.TaggedError<BinaryMismatched>()('BinaryMismatched', {
  url: Schema.URL,
  mismatch: Schema.Union([SizeMismatched, DigestMismatched, BinaryUnrunnable, ReleaseMisreported]),
}) {}

/** A step that writes the new binary beside the running one, or renames it over it, failed. */
export class ReplaceFailed extends Schema.TaggedError<ReplaceFailed>()('ReplaceFailed', {
  step: Schema.Enum(FileStep),
  path: Schema.String,
  reason: Schema.String,
}) {}

/** The command line does not parse into flags and arguments. */
export class ArgumentsUnparsed extends Schema.TaggedError<ArgumentsUnparsed>()('ArgumentsUnparsed', {
  reason: Schema.String,
}) {}

/** The global flags do not decode. */
export class FlagsInvalid extends Schema.TaggedError<FlagsInvalid>()('FlagsInvalid', { reason: Schema.String }) {}

/** The positional arguments begin with no command's words. */
export class CommandUnnamed extends Schema.TaggedError<CommandUnnamed>()('CommandUnnamed', {}) {}

/** The command was given another number of arguments than the ones it declares, by name. */
export class ArgumentsMismatched extends Schema.TaggedError<ArgumentsMismatched>()('ArgumentsMismatched', {
  command: Schema.String,
  arguments: Schema.Array(Schema.String),
}) {}

/** The command's flags and arguments do not decode as its input. */
export class InputInvalid extends Schema.TaggedError<InputInvalid>()('InputInvalid', {
  command: Schema.String,
  reason: Schema.String,
}) {}

/** The origin is not one a key may go to: an HTTPS URL, or plain HTTP on a loopback host. */
export class OriginInvalid extends Schema.TaggedError<OriginInvalid>()('OriginInvalid', {
  origin: Schema.String,
  reason: Schema.String,
}) {}

/** The output mode the flag or its variable names is not one of the `modes` the command writes. */
export class OutputModeRefused extends Schema.TaggedError<OutputModeRefused>()('OutputModeRefused', {
  mode: Schema.String,
  modes: Schema.Array(Schema.Enum(OutputMode)),
}) {}

/** The API key variable holds no Mechane key. */
export class ApiKeyInvalid extends Schema.TaggedError<ApiKeyInvalid>()('ApiKeyInvalid', {}) {}

/** The command line or the environment does not decode, as `problem` says; `output` is the mode its record goes in. */
export class UsageInvalid extends Schema.TaggedError<UsageInvalid>()('UsageInvalid', {
  problem: Schema.Union([
    ArgumentsUnparsed,
    FlagsInvalid,
    CommandUnnamed,
    ArgumentsMismatched,
    InputInvalid,
    OriginInvalid,
    OutputModeRefused,
    ApiKeyInvalid,
  ]),
  output: Schema.Enum(OutputMode),
}) {}

/** The command needs a key, and neither the API key variable nor a login saved for the origin supplies one. */
export class SavedLoginMissing extends Schema.TaggedError<SavedLoginMissing>()('SavedLoginMissing', {
  origin: Schema.String,
  /** The origin of a login saved for another; none when no login is saved. */
  savedOrigin: Schema.Option(Schema.String),
}) {}

/**
 * The deployment refused the saved login's key as unauthenticated, as `rejection` holds, so the CLI removed the saved
 * login at `path`.
 */
export class SavedLoginRejected extends Schema.TaggedError<SavedLoginRejected>()('SavedLoginRejected', {
  rejection: OperationFailed,
  path: Schema.String,
}) {}

/** The deployment named an approval page on another origin, where a person must never approve a key for it. */
export class VerificationUrlMismatched extends Schema.TaggedError<VerificationUrlMismatched>()(
  'VerificationUrlMismatched',
  { url: Schema.URL },
) {}

/** The deployment still reported the device approval pending after its own expiry, `timeout`. */
export class ApprovalTimedOut extends Schema.TaggedError<ApprovalTimedOut>()('ApprovalTimedOut', {
  userCode: Schema.String,
  timeout: Schema.Duration,
}) {}

/**
 * A step on a private file or folder of the CLI failed at the path it touched. Its reason is the system's text, or the
 * CLI's own for a saved login that does not decode, since the decoder's text could quote its key.
 */
export class CredentialsFailed extends Schema.TaggedError<CredentialsFailed>()('CredentialsFailed', {
  step: Schema.Enum(CredentialsStep),
  path: Schema.String,
  reason: Schema.String,
}) {}

/** A sandbox operation or archive transfer failed without discarding its durable server journal. */
export class SandboxMaintenanceFailed extends Schema.TaggedError<SandboxMaintenanceFailed>()(
  'SandboxMaintenanceFailed',
  { reason: Schema.String },
) {}
