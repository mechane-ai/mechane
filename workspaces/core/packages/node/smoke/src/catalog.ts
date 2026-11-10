import type { Scenario } from '@mechane/testing';
import { authenticationLimitsSurviveRestart } from './auth/authentication-limits-survive-restart.ts';
import { deviceApprovalRequiresTypedCodeAndCsrf } from './auth/device-approval-requires-typed-code-and-csrf.ts';
import { expiredKeyCannotAuthorizeRequests } from './auth/expired-key-cannot-authorize-requests.ts';
import { membershipChangesApplyImmediately } from './auth/membership-changes-apply-immediately.ts';
import { onlyBrowserCanApproveKeys } from './auth/only-browser-can-approve-keys.ts';
import { repeatedSignInReusesIdentity } from './auth/repeated-sign-in-reuses-identity.ts';
import { revokedKeyCannotAuthorizeRequests } from './auth/revoked-key-cannot-authorize-requests.ts';
import { backgroundCompletionWakesOnce } from './compute/background-completion-wakes-once.ts';
import { executionGrantIsCurrentAndTransient } from './compute/execution-grant-is-current-and-transient.ts';
import { interruptedCommandKeepsItsReceipt } from './compute/interrupted-command-keeps-its-receipt.ts';
import { consoleKeepsDraftsAndRunContext } from './console/console-keeps-drafts-and-run-context.ts';
import { consoleRetainsRecordsThroughRefreshFailure } from './console/console-retains-records-through-refresh-failure.ts';
import { boundedActivationPreservesWork } from './context/bounded-activation-preserves-work.ts';
import { contextSurvivesRestart } from './context/context-survives-restart.ts';
import { forkKeepsAnIndependentContext } from './context/fork-keeps-an-independent-context.ts';
import { gradesOnlyValidIsolatedEvaluations } from './evals/grades-only-valid-isolated-evaluations.ts';
import { producerIsBoundToRecipient } from './notifications/producer-is-bound-to-recipient.ts';
import { actorFailureRemainsInspectable } from './recovery/actor-failure-remains-inspectable.ts';
import { actorViewsReplayWithinTheirWorkspace } from './recovery/actor-views-replay-within-their-workspace.ts';
import { externalNotificationSurvivesRestart } from './recovery/external-notification-survives-restart.ts';
import { importedConversationRemainsReadable } from './recovery/imported-conversation-remains-readable.ts';
import { selfWakeSurvivesRestart } from './recovery/self-wake-survives-restart.ts';
import { cancellationPreservesPendingNotifications } from './runs/cancellation-preserves-pending-notifications.ts';
import { duplicateNotificationRunsAndChargesOnce } from './runs/duplicate-notification-runs-and-charges-once.ts';
import { pausedAdmissionResumes } from './runs/paused-admission-resumes.ts';
import { pendingNotificationPreventsStaleTool } from './runs/pending-notification-prevents-stale-tool.ts';
import { quietCompletionDrainsNotifications } from './runs/quiet-completion-drains-notifications.ts';
import { unfundedNotificationNeverReachesModel } from './runs/unfunded-notification-never-reaches-model.ts';
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
    guarantee: 'duplicate notifications run and charge exactly once without implicit publication',
    regression: 'a retried notification repeats paid work or private final text becomes a public reply',
    run: duplicateNotificationRunsAndChargesOnce,
  },
  {
    guarantee: 'an unfunded notification never reaches the model',
    regression: 'a model request begins before its spending reservation is admitted',
    run: unfundedNotificationNeverReachesModel,
  },
  {
    guarantee: 'cancellation stops later tools and preserves pending notifications',
    regression: 'a cancelled activation publishes a message or strands a pending notification',
    run: cancellationPreservesPendingNotifications,
  },
  {
    guarantee: 'a paused mech resumes its durable notifications after restart',
    regression: 'notifications accepted while paused disappear or require another wake after restart',
    run: pausedAdmissionResumes,
  },
  {
    guarantee: 'private context survives a process restart without public disclosure',
    regression: 'the next activation forgets prior work or exposes private context in the public conversation',
    run: contextSurvivesRestart,
  },
  {
    guarantee: 'a fork keeps an independent private context snapshot',
    regression: 'later parent work alters the fork or the fork loses its initial context',
    run: forkKeepsAnIndependentContext,
  },
  {
    guarantee: 'native compaction bounds working context while preserving history, effects, and charges',
    regression: 'compaction loses history, sends lifetime context, repeats effects, or omits a provider reservation',
    run: boundedActivationPreservesWork,
  },
  {
    guarantee: 'an external result resumes once after restart while unrelated work remains available',
    regression: 'waiting for an external result blocks the mech or duplicate results repeat its publication',
    run: externalNotificationSurvivesRestart,
  },
  {
    guarantee: 'a self wake survives restart with one immutable deadline and respects cancellation',
    regression: 'a scheduled wake is lost, repeated, shifted by retry, or delivered after cancellation',
    run: selfWakeSurvivesRestart,
  },
  {
    guarantee: 'newer notifications and workspace policy prevent stale effects before external dispatch',
    regression:
      'a correction or workspace suspension during tool discovery permits an obsolete effect or competing owner',
    run: pendingNotificationPreventsStaleTool,
  },
  {
    guarantee: 'quiet completion drains a concurrently accepted notification',
    regression: 'a no-tool model response strands a notification accepted before the mech becomes idle',
    run: quietCompletionDrainsNotifications,
  },
  {
    guarantee: 'notification producers are bound to their signed recipients and immutable notices',
    regression: 'a producer retargets a signed event, replaces accepted content, or falls back to broader authority',
    run: producerIsBoundToRecipient,
  },
  {
    guarantee: 'imported Console history stays readable with valid identifiers and unchanged content',
    regression:
      'a migration preserves SQL rows but breaks the authenticated conversation response or its activity links',
    run: importedConversationRemainsReadable,
  },
  {
    guarantee: 'actor views reconnect within their authenticated workspace without repeating effects',
    regression: 'reconnection repeats model work, corrupts the message, or exposes another workspace',
    run: actorViewsReplayWithinTheirWorkspace,
  },
  {
    guarantee: 'a failed provider request stays inspectable after restart without another model call',
    regression:
      'provider errors lose actionable diagnostics, disclose private fields, appear successful, or repeat model work on replay',
    run: actorFailureRemainsInspectable,
  },
  {
    guarantee: 'evaluations grade valid results without exposing expectations or repeating paid work',
    regression:
      'invalid grader output becomes a score, subjects see expectations, or a resumed evaluation repeats calls',
    run: gradesOnlyValidIsolatedEvaluations,
  },
  {
    guarantee: 'an interrupted command retains one receipt and recovers its committed environment',
    regression: 'a restart repeats a shell effect, loses committed files, or bypasses a failed checkpoint fence',
    run: interruptedCommandKeepsItsReceipt,
  },
  {
    guarantee: 'background completion wakes once while unrelated foreground work remains available',
    regression: 'callbacks repeat wakes or ordinary work stops the managed process before completion',
    run: backgroundCompletionWakesOnce,
  },
  {
    guarantee: 'execution grants are current and their credentials remain transient',
    regression: 'revoked execution access remains usable or resolved credentials become durable data',
    run: executionGrantIsCurrentAndTransient,
  },
  {
    guarantee: 'credentials stay out of durable execution records and logs',
    regression: 'actor persistence or diagnostics retain a resolved provider or user credential',
    run: credentialsStayOutOfDurableExecution,
  },
  {
    guarantee: 'Console keeps drafts isolated across mechs and preserves a draft through run navigation',
    regression: 'opening a run or switching mechs loses a draft or sends another mech its text',
    run: consoleKeepsDraftsAndRunContext,
  },
  {
    guarantee: 'Console restores durable records while HTTP refresh waits or fails',
    regression: 'a warm reload loses usable authorized records or hides refresh failure',
    run: consoleRetainsRecordsThroughRefreshFailure,
  },
];
