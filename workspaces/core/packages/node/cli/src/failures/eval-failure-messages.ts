import { ExitStatus } from '@mechane/commands';
import type { EvalFailure } from '@mechane/eval';
import { Option } from 'effect';
import { bareMessage } from './bare-message.ts';
import { ownMessage } from './own-message.ts';
import type { FailureMessages } from './types.ts';

const RESPONSE_RETRY = Option.some('inspect the mech activation history, then rerun with the same --out-folder');

/**
 * The report of each way an eval run fails beside its calls, under its tag. Every record the run saved stays, so a
 * rerun resumes.
 */
export const EVAL_FAILURE_MESSAGES: Readonly<FailureMessages<EvalFailure>> = {
  EvalAdapterFailed: ({ _tag, operation, reason }) =>
    bareMessage({ code: _tag, status: ExitStatus.Failed, message: `${operation}: ${reason}` }),
  EvalTransportFailed: ({ _tag, operation, reason }) =>
    bareMessage({ code: _tag, status: ExitStatus.Unavailable, message: `${operation}: ${reason}` }),
  EvalManifestMissing: ({ _tag, outFolder }) =>
    bareMessage({
      code: _tag,
      status: ExitStatus.InvalidRequest,
      message: `read evaluation manifest in ${outFolder}: no manifest exists`,
    }),
  SuiteInvalid: ({ _tag, path, reason }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.InvalidRequest,
      message: `the suite ${path} is not one: ${reason}`,
      next: Option.none(),
    }),
  OutFolderBusy: ({ _tag, path }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Conflict,
      message: `acquire evaluation lock ${path}: another writer holds it`,
      next: Option.some('wait for the current writer to finish, then retry the same output folder'),
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
  EvalResponseInvalid: ({ _tag, mechId, reason }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Failed,
      message: `read evaluation progress for mech ${mechId}: ${reason}`,
      next: RESPONSE_RETRY,
    }),
  EvalInterrupted: ({ _tag, outFolder }) => ({
    status: ExitStatus.Interrupted,
    record: { code: _tag, message: 'Ctrl-C interrupted the run', family: Option.none() },
    text: `interrupted; run it again with --out-folder ${outFolder} to resume`,
    isLabelled: true,
  }),
};
