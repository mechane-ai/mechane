import { Schema } from 'effect';
import { EvalFileStep } from './constants.ts';

/** The turns a plan has not saved yet could, each at its mech's cap, spend more than the day's allowance has left. */
export class AllowanceExhausted extends Schema.TaggedError<AllowanceExhausted>()('AllowanceExhausted', {
  day: Schema.String,
  neededMicros: Schema.Int,
  remainingMicros: Schema.Int,
}) {}

/** A step on a file or folder of the out folder failed; `path` names what the step read, wrote or removed. */
export class EvalFileFailed extends Schema.TaggedError<EvalFileFailed>()('EvalFileFailed', {
  step: Schema.Enum(EvalFileStep),
  path: Schema.String,
  reason: Schema.String,
}) {}

/** Ctrl-C interrupted an eval run once its finalizers ran; every record it saved stays, so a rerun resumes. */
export class EvalInterrupted extends Schema.TaggedError<EvalInterrupted>()('EvalInterrupted', {
  outFolder: Schema.String,
}) {}

/**
 * Another run, in the process the out folder's lock names, writes the out folder's records, which one run at a time
 * writes.
 */
export class OutFolderBusy extends Schema.TaggedError<OutFolderBusy>()('OutFolderBusy', {
  path: Schema.String,
  processId: Schema.Int,
}) {}

/**
 * The out folder holds the plan of another suite, release, worker revision or workspace, whose records a run never
 * mixes with its own.
 */
export class PlanChanged extends Schema.TaggedError<PlanChanged>()('PlanChanged', {
  path: Schema.String,
  savedDigest: Schema.String,
  plannedDigest: Schema.String,
}) {}

/** The suite file could not be read, or does not decode as a suite, for `reason`. */
export class SuiteInvalid extends Schema.TaggedError<SuiteInvalid>()('SuiteInvalid', {
  path: Schema.String,
  reason: Schema.String,
}) {}
