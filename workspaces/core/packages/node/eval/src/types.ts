import type { ClientFailure } from '@mechane/client';
import type { Effect, Option, Redacted } from 'effect';
import type {
  AllowanceExhausted,
  EvalFileFailed,
  EvalInterrupted,
  OutFolderBusy,
  PlanChanged,
  SuiteInvalid,
} from './errors.ts';
import type { Intent, OutFolderLock } from './schemas.ts';
import type { GradeRecord, Plan, Report, TurnRecord } from './store/schemas.ts';

/** Every way an eval fails beside its calls: its suite, its out folder's plan or files, the allowance, or a Ctrl-C. */
export type EvalFailure =
  | SuiteInvalid
  | OutFolderBusy
  | PlanChanged
  | AllowanceExhausted
  | EvalFileFailed
  | EvalInterrupted;

/** The key a mech command sends, and the caller's one workspace, where every mech command acts. */
export type WorkspaceAccess = { readonly token: Redacted.Redacted; readonly workspaceId: string };

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

/** The records of one trial, in its own folder. */
export type TrialFiles = {
  readonly subjectIntent: OnceFile<Intent>;
  readonly subject: OnceFile<TurnRecord>;
  readonly graderIntent: OnceFile<Intent>;
  readonly grade: OnceFile<GradeRecord>;
};

type TrialIdInput = { readonly trialId: string };

type ReportInput = { readonly report: Report };

/** A line of a run's progress, such as the role of a trial it runs. */
type ProgressLine = { readonly line: string };

/** Writes a line of the run's progress, which its program shows as the run goes. */
export type WriteProgress = (input: ProgressLine) => void;

/** Every way a run fails: its own failures, and its calls'. */
export type EvalRunFailure = EvalFailure | ClientFailure;

/**
 * The out folder's records: the plan, each trial's files, and the report, which a run replaces each time it derives
 * one, since only the records decide it.
 */
export type EvalStore = {
  readonly lock: OnceFile<OutFolderLock>;
  readonly plan: OnceFile<Plan>;
  readonly trial: (input: TrialIdInput) => TrialFiles;
  readonly saveReport: (input: ReportInput) => Effect.Effect<void, EvalFileFailed>;
};
