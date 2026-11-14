import type { ClientFailure } from '@mechane/client';
import type { WorkspaceId } from '@mechane/records';
import type { Effect, Option, Redacted } from 'effect';
import type {
  AllowanceExhausted,
  EvalAdapterFailed,
  EvalFileFailed,
  EvalInterrupted,
  EvalManifestMissing,
  EvalResponseInvalid,
  EvalTransportFailed,
  OutFolderBusy,
  PlanChanged,
  SuiteInvalid,
} from './errors.ts';

/** Every way an eval fails beside its calls: its suite, its out folder's plan or files, the allowance, or a Ctrl-C. */
export type EvalFailure =
  | SuiteInvalid
  | OutFolderBusy
  | PlanChanged
  | AllowanceExhausted
  | EvalFileFailed
  | EvalInterrupted
  | EvalResponseInvalid
  | EvalAdapterFailed
  | EvalTransportFailed
  | EvalManifestMissing;

/** The key a mech command sends, and the caller's one workspace, where every mech command acts. */
export type WorkspaceAccess = { readonly token: Redacted.Redacted; readonly workspaceId: WorkspaceId };

/** A record to save. */
type RecordInput<A> = { readonly record: A };

/**
 * A file of the out folder that holds one record, written once: `create` fails when the file exists. It never leaves a
 * partial file.
 */
export type OnceFile<A> = {
  readonly path: string;
  /** Answers none while the file does not exist. */
  readonly read: () => Effect.Effect<Option.Option<A>, EvalFileFailed>;
  readonly create: (input: RecordInput<A>) => Effect.Effect<void, EvalFileFailed>;
};

/** A line of a run's progress, such as the role of a trial it runs. */
type ProgressLine = { readonly line: string };

/** Writes a line of the run's progress, which its program shows as the run goes. */
export type WriteProgress = (input: ProgressLine) => void;

/** Every way a run fails: its own failures, and its calls'. */
export type EvalRunFailure = EvalFailure | ClientFailure;
