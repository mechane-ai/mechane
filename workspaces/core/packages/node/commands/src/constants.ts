/** The variable whose key a command sends in place of the saved login's; a secret never goes on a command line. */
export const API_KEY_VARIABLE = 'MECHANE_API_KEY';

/** The variable that names the folder of user configuration files, by the XDG convention. */
export const CONFIG_HOME_VARIABLE = 'XDG_CONFIG_HOME';

/** How a command writes its result: one result when it ends, or one record for each item as it arrives. */
export const CommandShape = { Document: 'document', Stream: 'stream' } as const;

export type CommandShape = (typeof CommandShape)[keyof typeof CommandShape];

/**
 * The deployment a command calls when neither `--origin` nor its variable names one: production's, the origin
 * `packages/worker/app/wrangler.jsonc` gives the Worker. A local stack and the smoke always name their own.
 */
export const DEFAULT_ORIGIN = 'https://mechane.ai';

/**
 * The code of each failure the CLI reports under its own name, which its error record carries; an error a deployment
 * answered carries the deployment's code instead. A code ships, so the reference lists each one.
 */
export const ErrorCode = {
  WorkspaceSelectionRefused: 'WorkspaceSelectionRefused',
  SandboxMaintenanceFailed: 'SandboxMaintenanceFailed',
  UsageInvalid: 'UsageInvalid',
  OriginUnreachable: 'OriginUnreachable',
  RequestTimedOut: 'RequestTimedOut',
  ResponseUnreadable: 'ResponseUnreadable',
  CredentialsFailed: 'CredentialsFailed',
  SavedLoginMissing: 'SavedLoginMissing',
  VerificationUrlMismatched: 'VerificationUrlMismatched',
  ApprovalTimedOut: 'ApprovalTimedOut',
  ReleaseStampMissing: 'ReleaseStampMissing',
  TargetUnpublished: 'TargetUnpublished',
  BinaryMismatched: 'BinaryMismatched',
  ReplaceFailed: 'ReplaceFailed',
  SuiteInvalid: 'SuiteInvalid',
  OutFolderBusy: 'OutFolderBusy',
  PlanChanged: 'PlanChanged',
  AllowanceExhausted: 'AllowanceExhausted',
  EvalFileFailed: 'EvalFileFailed',
  EvalInterrupted: 'EvalInterrupted',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** How the process ends; each failure family of the API maps to one of these. */
export const ExitStatus = {
  Ok: 0,
  Failed: 1,
  InvalidRequest: 2,
  Unauthenticated: 3,
  ForbiddenOrNotFound: 4,
  Conflict: 5,
  Unavailable: 6,
  Interrupted: 130,
} as const;

export type ExitStatus = (typeof ExitStatus)[keyof typeof ExitStatus];

/** How a flag reads its value: the text after it, or its presence alone. */
export const FlagKind = { Text: 'text', Switch: 'switch' } as const;

export type FlagKind = (typeof FlagKind)[keyof typeof FlagKind];

/** The variable that names the output mode when the output flag names none. */
export const OUTPUT_VARIABLE = 'MECHANE_OUTPUT';

/** The default workspace selector for invocations that omit --workspace. */
export const WORKSPACE_VARIABLE = 'MECHANE_WORKSPACE_ID';

/** How a command writes its result to standard output. */
export const OutputMode = { Human: 'human', Json: 'json', Jsonl: 'jsonl' } as const;

export type OutputMode = (typeof OutputMode)[keyof typeof OutputMode];

/** The program's name, which prefixes each diagnostic it writes. */
export const PROGRAM = 'mechane';

/**
 * The command word that prints the release, as `--version` does. It reads no deployment, so the version flag declares
 * it. The settings carry it out beside the flag, since every command calls an origin.
 */
export const VERSION_COMMAND = 'version';

/** The output mode when neither `--output` nor its variable names one, off a terminal by the command's shape. */
export const DEFAULT_OUTPUT = {
  onTerminal: OutputMode.Human,
  elsewhere: { [CommandShape.Document]: OutputMode.Json, [CommandShape.Stream]: OutputMode.Jsonl },
} as const;
