import { ExitStatus } from '@mechane/commands';
import type { EvalFailure } from '@mechane/eval';
import { Option } from 'effect';
import { bareMessage } from './bare-message.ts';
import { ownMessage } from './own-message.ts';
import type { FailureMessages } from './types.ts';

/**
 * The report of each way an eval run fails beside its calls, under its tag. Every record the run saved stays, so a
 * rerun resumes.
 */
export const EVAL_FAILURE_MESSAGES: Readonly<FailureMessages<EvalFailure>> = {
  SuiteInvalid: ({ _tag, path, reason }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.InvalidRequest,
      message: `the suite ${path} is not one: ${reason}`,
      next: Option.none(),
    }),
  OutFolderBusy: ({ _tag, path, processId }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Conflict,
      message: `process ${processId} runs into this out folder, as ${path} says`,
      next: Option.some('wait for it to end, or remove the lock if no run uses the folder'),
    }),
  PlanChanged: ({ _tag, path, savedDigest, plannedDigest }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Conflict,
      message: `${path} holds plan ${savedDigest}, where this run plans ${plannedDigest}`,
      next: Option.some('give a new --out-folder for a changed suite or deployment'),
    }),
  AllowanceExhausted: ({ _tag, neededMicros, day, remainingMicros }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Failed,
      message: `the trials could spend ${neededMicros} micro-dollars, where ${day} has ${remainingMicros} left`,
      next: Option.some('lower trial_cap_micros, run fewer trials, or wait for the next UTC day'),
    }),
  EvalFileFailed: ({ _tag, step, path, reason }) =>
    bareMessage({ code: _tag, status: ExitStatus.Failed, message: `${step} ${path}: ${reason}` }),
  EvalInterrupted: ({ _tag, outFolder }) => ({
    status: ExitStatus.Interrupted,
    record: { code: _tag, message: 'Ctrl-C interrupted the run', family: Option.none() },
    text: `interrupted; run it again with --out-folder ${outFolder} to resume`,
    isLabelled: true,
  }),
};
