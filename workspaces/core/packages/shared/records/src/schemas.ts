import { Duration, Schema, SchemaTransformation } from 'effect';
import { PRINTABLE_PATTERN, RANDOM_UUID_VERSION, RECORD_TEXT_MAX_CHARS } from './constants.ts';
import { IdentityProvider } from './identity-provider.constants.ts';

/** The provider's stable subject identifies a browser user; the display name grants no authority. */
export const BrowserIdentity = Schema.Struct({
  provider: Schema.Enum(IdentityProvider),
  subject: Schema.String,
  name: Schema.String,
});

export type BrowserIdentity = typeof BrowserIdentity.Type;

/** The configured GitHub OAuth application's public client identifier. */
export const GitHubClientId = Schema.NonEmptyString.pipe(Schema.brand('GitHubClientId'));

export type GitHubClientId = typeof GitHubClientId.Type;

/** A display name never establishes the principal's identity or authority. */
export const DirectoryPrincipal = Schema.Struct({ id: Schema.String, name: Schema.String });

export type DirectoryPrincipal = typeof DirectoryPrincipal.Type;

/** The id of a record the deployment keeps, a random UUID. */
export const RecordId = Schema.String.check(Schema.isUUID());

export type RecordId = typeof RecordId.Type;

/** The id a caller makes for a record it asks the deployment to keep, so a retry names the same one: a random UUID. */
export const RandomId = Schema.String.check(Schema.isUUID(RANDOM_UUID_VERSION));

export type RandomId = typeof RandomId.Type;

/** The id of a turn of a mech's work. */
export const TurnId = RecordId.pipe(Schema.brand('TurnId'));

export type TurnId = typeof TurnId.Type;

/** The id of a dispatch, one model request of a turn. */
export const DispatchId = RecordId.pipe(Schema.brand('DispatchId'));

export type DispatchId = typeof DispatchId.Type;

/** The id of a thread a mech opened. */
export const ThreadId = RecordId.pipe(Schema.brand('ThreadId'));

export type ThreadId = typeof ThreadId.Type;

/** The id of a drone a mech started on one of its threads. */
export const DroneId = RecordId.pipe(Schema.brand('DroneId'));

export type DroneId = typeof DroneId.Type;

/** A count that is never negative, which each unit brand types by what it counts. */
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** Money in micro-dollars, millionths of a dollar. */
export const Micros = Count.pipe(Schema.brand('Micros'));

export type Micros = typeof Micros.Type;

/** A count of a model's tokens. */
export const Tokens = Count.pipe(Schema.brand('Tokens'));

export type Tokens = typeof Tokens.Type;

/** A size in bytes. */
export const Bytes = Count.pipe(Schema.brand('Bytes'));

export type Bytes = typeof Bytes.Type;

/** A place in a log, such as an event's in its mech's log. */
export const Sequence = Count.pipe(Schema.brand('Sequence'));

export type Sequence = typeof Sequence.Type;

/** A span written as whole seconds, the sibling of Effect's `DurationFromMillis` that Effect lacks. */
export const DurationFromSeconds = Schema.Int.pipe(
  Schema.decodeTo(
    Schema.Duration,
    SchemaTransformation.transform({ decode: Duration.seconds, encode: Duration.toSeconds }),
  ),
);

export type DurationFromSeconds = typeof DurationFromSeconds.Type;

/** Checks a span between two bounds, as Effect's `isBetweenDate` checks a date; it checks a span built in code too. */
export const isBetweenDuration = Schema.makeIsBetween({ order: Duration.Order, formatter: Duration.format });

/**
 * A text of whole characters: one with half of a UTF-16 surrogate pair alone is no Unicode text, and no row, file or
 * JSON encoder holds it as written.
 */
export const isWellFormedText = Schema.makeFilter((text: string) => text.isWellFormed(), {
  expected: 'a text of whole characters, without half of a UTF-16 surrogate pair alone',
});

/** A name a person chooses to tell records apart, which terminals print: trimmed, with no control character. */
export const PrintableName = Schema.String.check(
  isWellFormedText,
  Schema.isTrimmed(),
  Schema.isPattern(PRINTABLE_PATTERN),
);

export type PrintableName = typeof PrintableName.Type;

/** A text a record holds, as any deployment may have stored it: of whole characters, at most a row's worth. */
export const RecordText = Schema.String.check(isWellFormedText, Schema.isMaxLength(RECORD_TEXT_MAX_CHARS));

export type RecordText = typeof RecordText.Type;

/** A name a record holds, as any deployment may have stored it: printable, at most a row's worth. */
export const RecordName = PrintableName.check(Schema.isMaxLength(RECORD_TEXT_MAX_CHARS));

export type RecordName = typeof RecordName.Type;

/** The retry identity of one explicit sandbox maintenance operation. */
export const SandboxOperationId = RecordId.pipe(Schema.brand('SandboxOperationId'));
export type SandboxOperationId = typeof SandboxOperationId.Type;

/** The persistent VM identity assigned by the sandbox provider. */
export const RemoteSandboxId = Schema.NonEmptyString.pipe(Schema.brand('RemoteSandboxId'));
export type RemoteSandboxId = typeof RemoteSandboxId.Type;
