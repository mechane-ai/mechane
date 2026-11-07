import type { Scenario } from '@mechane/testing';
import { authenticationLimitsSurviveRestart } from './auth/authentication-limits-survive-restart.ts';
import { deviceApprovalRequiresTypedCodeAndCsrf } from './auth/device-approval-requires-typed-code-and-csrf.ts';
import { expiredKeyCannotAuthorizeRequests } from './auth/expired-key-cannot-authorize-requests.ts';
import { membershipChangesApplyImmediately } from './auth/membership-changes-apply-immediately.ts';
import { onlyBrowserCanApproveKeys } from './auth/only-browser-can-approve-keys.ts';
import { repeatedSignInReusesIdentity } from './auth/repeated-sign-in-reuses-identity.ts';
import { revokedKeyCannotAuthorizeRequests } from './auth/revoked-key-cannot-authorize-requests.ts';
import { executionGrantIsCurrentAndTransient } from './compute/execution-grant-is-current-and-transient.ts';
import { interruptedCommandKeepsItsReceipt } from './compute/interrupted-command-keeps-its-receipt.ts';
import { gradesOnlyValidIsolatedEvaluations } from './evals/grades-only-valid-isolated-evaluations.ts';
import { forkKeepsAnIndependentMemorySnapshot } from './memory/fork-keeps-an-independent-memory-snapshot.ts';
import { memorySurvivesRestart } from './memory/memory-survives-restart.ts';
import { approvalWaitSurvivesRestart } from './recovery/approval-wait-survives-restart.ts';
import { nativeStreamFailureIsReplayable } from './recovery/native-stream-failure-is-replayable.ts';
import { nativeStreamReplaysWithinItsWorkspace } from './recovery/native-stream-replays-within-its-workspace.ts';
import { cancellationStopsToolsAndAdvancesQueue } from './runs/cancellation-stops-tools-and-advances-queue.ts';
import { duplicateInputRunsAndChargesOnce } from './runs/duplicate-input-runs-and-charges-once.ts';
import { pausedAdmissionResumes } from './runs/paused-admission-resumes.ts';
import { unfundedInputNeverReachesModel } from './runs/unfunded-input-never-reaches-model.ts';
import { credentialsStayOutOfDurableExecution } from './security/credentials-stay-out-of-durable-execution.ts';

export const CATALOG: ReadonlyArray<Scenario> = [
  {
    guarantee: 'authentication limits survive restart and remain scoped to their caller',
    regression: 'an attacker evades persisted device-code limits or prevents another principal from signing in',
    run: authenticationLimitsSurviveRestart,
  },
  {
    guarantee: 'repeated GitHub sign-in reuses one principal and personal workspace',
    regression: 'one provider identity creates duplicate ownership records',
    run: repeatedSignInReusesIdentity,
  },
  {
    guarantee: 'only a browser session can approve a new API key',
    regression: 'an existing API key escalates itself by minting another credential',
    run: onlyBrowserCanApproveKeys,
  },
  {
    guarantee: 'device approval requires the typed code and its browser CSRF token',
    regression: 'a crafted link or cross-origin form grants an unattended device key',
    run: deviceApprovalRequiresTypedCodeAndCsrf,
  },
  {
    guarantee: 'revoked keys cannot authorize later requests',
    regression: 'logout or key revocation leaves a credential usable',
    run: revokedKeyCannotAuthorizeRequests,
  },
  {
    guarantee: 'expired keys cannot authorize requests',
    regression: 'an elapsed credential lifetime does not revoke API access',
    run: expiredKeyCannotAuthorizeRequests,
  },
  {
    guarantee: 'workspace membership changes govern the next request',
    regression: 'a removed member keeps access or a member changes owner-only configuration',
    run: membershipChangesApplyImmediately,
  },
  {
    guarantee: 'duplicate inputs run and charge exactly once',
    regression: 'a retried input repeats model work or bills the same usage twice',
    run: duplicateInputRunsAndChargesOnce,
  },
  {
    guarantee: 'an unfunded input never reaches the model',
    regression: 'a model request begins before its spending reservation is admitted',
    run: unfundedInputNeverReachesModel,
  },
  {
    guarantee: 'cancellation stops later tools and advances queued work',
    regression: 'cancelled work mutates memory or strands the next accepted input',
    run: cancellationStopsToolsAndAdvancesQueue,
  },
  {
    guarantee: 'a paused mech resumes its accepted input without another message',
    regression: 'resuming a mech strands queued work that already has a durable workflow',
    run: pausedAdmissionResumes,
  },
  {
    guarantee: 'acknowledged memory survives a process restart',
    regression: 'durable memory exists only in process state or the conversation transcript',
    run: memorySurvivesRestart,
  },
  {
    guarantee: 'a fork keeps an independent memory snapshot',
    regression: 'later parent writes alter the fork or the fork loses its initial memory',
    run: forkKeepsAnIndependentMemorySnapshot,
  },
  {
    guarantee: 'a Slack approval wait resumes once after a process restart',
    regression: 'an approval loses the task, repeats an effect, or replies in the wrong Slack thread',
    run: approvalWaitSurvivesRestart,
  },
  {
    guarantee: 'native UI streams replay within their authenticated workspace',
    regression: 'reconnection repeats model work, corrupts the message, or exposes another workspace',
    run: nativeStreamReplaysWithinItsWorkspace,
  },
  {
    guarantee: 'a failed native stream reports its error and replays without another model call',
    regression: 'a failed run appears to finish successfully or reconnecting repeats its model request',
    run: nativeStreamFailureIsReplayable,
  },
  {
    guarantee: 'evaluations grade valid results without exposing expectations or repeating paid work',
    regression:
      'invalid grader output becomes a score, subjects see expectations, or a resumed evaluation repeats calls',
    run: gradesOnlyValidIsolatedEvaluations,
  },
  {
    guarantee: 'an interrupted command retains one receipt and its mech workspace',
    regression: 'a runtime restart repeats a shell effect or loses the persistent workspace',
    run: interruptedCommandKeepsItsReceipt,
  },
  {
    guarantee: 'execution grants are current and their credentials remain transient',
    regression: 'revoked execution access remains usable or resolved credentials become durable data',
    run: executionGrantIsCurrentAndTransient,
  },
  {
    guarantee: 'credentials stay out of durable execution records and logs',
    regression: 'workflow serialization or diagnostics retain a resolved provider or user credential',
    run: credentialsStayOutOfDurableExecution,
  },
];
