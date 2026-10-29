import type { ClientFailure, OperationCall } from '@mechane/client';
import type { CommandInput, CommandName, COMMANDS, ExitStatus, OutputMode } from '@mechane/commands';
import type { EvalFailure } from '@mechane/eval';
import type { CliTarget, Release } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import type { Effect, Option, Redacted } from 'effect';
import type { CredentialSource, InvocationKind, RunOutcome } from './constants.ts';
import type {
  ApprovalTimedOut,
  BinaryMismatched,
  CredentialsFailed,
  ReleaseStampMissing,
  ReplaceFailed,
  SandboxMaintenanceFailed,
  SavedLoginMissing,
  SavedLoginRejected,
  TargetUnpublished,
  UsageInvalid,
  VerificationUrlMismatched,
  WorkspaceSelectionRefused,
} from './errors.ts';
import type { COMMAND_OUTPUTS } from './output/command-outputs.ts';
import type { ErrorRecord } from './schemas.ts';

/** A result for the output module to write in the invocation's output mode. */
export type ResultRecord<N extends CommandName> = { readonly result: CommandResult<N> };

/** A binary a release compiled: its stamp's target, and the path the runtime runs it from. */
export type ReleasedBinary = { readonly target: CliTarget; readonly path: string };

/** Every way an update fails beside its requests: the program, the release, its binary, or the swap. */
export type UpdateFailure = ReleaseStampMissing | TargetUnpublished | BinaryMismatched | ReplaceFailed;

/** Every way a binary can differ from its release: its size, its digest, its run, or the release it reports. */
export type BinaryMismatch = BinaryMismatched['mismatch'];

/** A failed run's report to write, in its output mode, under its command. */
export type WriteFailureInput = {
  readonly output: OutputMode;
  /** None when the command line names no command. */
  readonly command: Option.Option<CommandName>;
  readonly report: FailureReport;
};

/** A command to run, with every setting it reads decoded; `input` is its own flags' and arguments'. */
export type CommandInvocation<N extends CommandName = CommandName> = {
  readonly kind: typeof InvocationKind.Command;
  readonly command: N;
  readonly input: CommandInput<N>;
  readonly origin: URL;
  readonly output: OutputMode;
  readonly credentials: CredentialSettings;
  /** None selects the personal workspace. */
  readonly selectedWorkspaceId: Option.Option<WorkspaceId>;
  readonly program: ProgramSettings;
};

/**
 * Every way a command's run fails: its calls, the server's refusal of its saved login, its credentials, an update, or
 * an eval run.
 */
export type RunFailure =
  | WorkspaceSelectionRefused
  | SandboxMaintenanceFailed
  | ClientFailure
  | SavedLoginRejected
  | CredentialFailure
  | UpdateFailure
  | EvalFailure;

/** Every way a command's credentials fail beside the server: its private files, its saved login, or its approval. */
export type CredentialFailure = CredentialsFailed | SavedLoginMissing | VerificationUrlMismatched | ApprovalTimedOut;

/** Why a command line or the environment does not decode. */
export type UsageProblem = UsageInvalid['problem'];

/** How a run failed: its exit status, its error record and the diagnostic a person reads. */
export type FailureReport = { readonly status: ExitStatus; readonly record: ErrorRecord; readonly diagnostic: string };

/**
 * The program the runtime runs: its release, the binary a release compiled, and the `user-agent` its requests send. It
 * has no binary when it runs from source or as a binary no release stamped, such as `mise run build:cli` compiles.
 */
export type ProgramSettings = {
  readonly release: Release;
  /** Absent when no release stamped the program. */
  readonly binary: Option.Option<ReleasedBinary>;
  /** Its release and its binary's target, such as `mechane/0.1.0 (linux-x64)`, or `source` for an unstamped one. */
  readonly userAgent: string;
};

/** The result of a command, as its output schema types it. */
export type CommandOutput<N extends CommandName> = (typeof COMMAND_OUTPUTS)[N]['Type'];

/** What a command produced: the lines a person reads, and the result its output schema encodes for a program. */
export type CommandResult<N extends CommandName> = {
  readonly lines: ReadonlyArray<string>;
  readonly result: CommandOutput<N>;
};

/** Where a command finds its key: the API key variable's when it holds one, else the login saved below the root. */
export type CredentialSettings = {
  /** Absent when the API key variable is unset. */
  readonly apiKey: Option.Option<Redacted.Redacted>;
  /** The folder whose `mechane` folder holds the saved login. */
  readonly configurationRoot: string;
};

/** The key a command sends, and where it came from. */
export type Credential = { readonly token: Redacted.Redacted; readonly source: CredentialSource };

/** The operations a command declares that it calls, which its reference publishes. */
type CommandOperation<N extends CommandName> = (typeof COMMANDS)[N]['operations'][number];

/** What a command's run reads: the calls it may make, its origin, its input, its key and the running program. */
export type RunInput<N extends CommandName> = {
  /** Calls an operation the command declares; a run that calls an undeclared one fails to compile. */
  readonly call: OperationCall<CommandOperation<N>>;
  readonly origin: URL;
  readonly input: CommandInput<N>;
  readonly credentials: CredentialSettings;
  /** None selects the personal workspace. */
  readonly selectedWorkspaceId: Option.Option<WorkspaceId>;
  /** The program that runs, which `mechane update` replaces when a release build compiled it. */
  readonly program: ProgramSettings;
};

/** What a command's run reads, and the writer of its results. */
export type CommandRunInput<N extends CommandName> = RunInput<N> & {
  /** The writer the output module hands a run, which writes each result as one record of the command's output. */
  readonly write: (input: ResultRecord<N>) => void;
};

/**
 * The work of one command: it calls the deployment, writes its results through the output module's writer, and answers
 * how it ended, which decides the exit status.
 */
export type Run<N extends CommandName> = (input: CommandRunInput<N>) => Effect.Effect<RunOutcome, RunFailure>;

/** Where a page of a list starts: after the record with the id. */
export type PageCursor<Id> = {
  /** Absent at the list's start. */
  readonly after: Option.Option<Id>;
};
