import type { Scenario } from '@mechane/testing';
import { authenticationLimitsSurviveRestart } from './auth/authentication-limits-survive-restart.ts';
import { deviceApprovalRequiresTypedCodeAndCsrf } from './auth/device-approval-requires-typed-code-and-csrf.ts';
import { expiredKeyCannotAuthorizeRequests } from './auth/expired-key-cannot-authorize-requests.ts';
import { membershipChangesApplyImmediately } from './auth/membership-changes-apply-immediately.ts';
import { onlyBrowserCanApproveKeys } from './auth/only-browser-can-approve-keys.ts';
import { repeatedSignInReusesIdentity } from './auth/repeated-sign-in-reuses-identity.ts';
import { revokedKeyCannotAuthorizeRequests } from './auth/revoked-key-cannot-authorize-requests.ts';
import { workspaceServiceKeysIsolateCreators } from './auth/workspace-service-keys-isolate-creators.ts';
import { backgroundProcessKeepsItsCompletion } from './compute/background-process-keeps-its-completion.ts';
import { checkpointedFilesSurviveMachineLoss } from './compute/checkpointed-files-survive-machine-loss.ts';
import { drainCompletesBeforePendingBash } from './compute/drain-completes-before-pending-bash.ts';
import { executionGrantIsCurrentAndTransient } from './compute/execution-grant-is-current-and-transient.ts';
import { installedCapacityProtectsPhysicalMachines } from './compute/installed-capacity-protects-physical-machines.ts';
import { installedWorkerRecoversInterruptedCommand } from './compute/installed-worker-recovers-interrupted-command.ts';
import { largeHomeSurvivesRestore } from './compute/large-home-survives-restore.ts';
import { recordingFailurePreservesEnvironment } from './compute/recording-failure-preserves-environment.ts';
import { remoteToolGrantsHonorPolicy } from './compute/remote-tool-grants-honor-policy.ts';
import { stoppedProcessRemainsInspectable } from './compute/stopped-process-remains-inspectable.ts';
import { consoleKeepsSessionDraftsIsolated } from './console/console-keeps-session-drafts-isolated.ts';
import { consoleOpensSessionEvidence } from './console/console-opens-session-evidence.ts';
import { consoleRetainsRecordsThroughRefreshFailure } from './console/console-retains-records-through-refresh-failure.ts';
import { consoleRevokesDeniedSession } from './console/console-revokes-denied-session.ts';
import { compactionPreservesSession } from './context/compaction-preserves-session.ts';
import { queuedInputKeepsSessionContext } from './context/queued-input-keeps-session-context.ts';
import { gradesOnlyValidIsolatedEvaluations } from './evals/grades-only-valid-isolated-evaluations.ts';
import { attachedMemoryGuidesProvider } from './managed-agents/attached-memory-guides-provider.ts';
import { coordinatorReceivesChildReport } from './managed-agents/coordinator-receives-child-report.ts';
import { coordinatorRevisitsSelf } from './managed-agents/coordinator-revisits-self.ts';
import { gitResourceCredentialsStayPrivate } from './managed-agents/git-resource-credentials-stay-private.ts';
import { largeEventReplays } from './managed-agents/large-event-replays.ts';
import { managedAgentLifecycle } from './managed-agents/managed-agent-lifecycle.ts';
import { managedOidcRolesScopeResources } from './managed-agents/managed-oidc-roles-scope-resources.ts';
import { messagePreviewsReconcile } from './managed-agents/message-previews-reconcile.ts';
import { nativeGatewayConfirmsFastUsage } from './managed-agents/native-gateway-confirms-fast-usage.ts';
import { outcomesReviseAndSettle } from './managed-agents/outcomes-revise-and-settle.ts';
import { scopedWorkerDeliversToolResult } from './managed-agents/scoped-worker-delivers-tool-result.ts';
import { sessionBudgetResumes } from './managed-agents/session-budget-resumes.ts';
import { sessionsReplayIndependently } from './managed-agents/sessions-replay-independently.ts';
import { sharedMemoryIsScoped } from './managed-agents/shared-memory-is-scoped.ts';
import { confirmedCleanupReleasesPersistentOwnership } from './recovery/confirmed-cleanup-releases-persistent-ownership.ts';
import { customToolResultSurvivesRestart } from './recovery/custom-tool-result-survives-restart.ts';
import { importedConversationRemainsReadable } from './recovery/imported-conversation-remains-readable.ts';
import { sessionEventsReplayWithinTheirWorkspace } from './recovery/session-events-replay-within-their-workspace.ts';
import { sessionFailureRemainsInspectable } from './recovery/session-failure-remains-inspectable.ts';
import { installedWorkerFinishesInterruptedTool } from './runs/installed-worker-finishes-interrupted-tool.ts';
import { interruptRedirectsSession } from './runs/interrupt-redirects-session.ts';
import { workspaceBudgetGuardsSession } from './runs/workspace-budget-guards-session.ts';
import { credentialsStayOutOfDurableExecution } from './security/credentials-stay-out-of-durable-execution.ts';

export const CATALOG = [
  {
    family: 'auth',
    guarantee: 'authentication limits survive restart and remain scoped to their caller',
    regression: 'an attacker evades persisted device-code limits or prevents another principal from signing in',
    run: authenticationLimitsSurviveRestart,
  },
  {
    family: 'auth',
    guarantee: 'repeated GitHub sign-in reuses one principal and personal workspace',
    regression: 'one provider identity creates duplicate ownership records',
    run: repeatedSignInReusesIdentity,
  },
  {
    family: 'auth',
    guarantee: 'only a browser session can approve a new API key',
    regression: 'an existing API key escalates itself by minting another credential',
    run: onlyBrowserCanApproveKeys,
  },
  {
    family: 'auth',
    guarantee: 'device approval requires the typed code and its browser CSRF token',
    regression: 'a crafted link or cross-origin form grants an unattended device key',
    run: deviceApprovalRequiresTypedCodeAndCsrf,
  },
  {
    family: 'auth',
    guarantee: 'revoked keys cannot authorize later requests',
    regression: 'logout or key revocation leaves a credential usable',
    run: revokedKeyCannotAuthorizeRequests,
  },
  {
    family: 'auth',
    guarantee: 'expired keys cannot authorize requests',
    regression: 'an elapsed credential lifetime does not revoke API access',
    run: expiredKeyCannotAuthorizeRequests,
  },
  {
    family: 'auth',
    guarantee: 'workspace membership changes govern the next request',
    regression: 'a removed member keeps access or a member changes owner-only configuration',
    run: membershipChangesApplyImmediately,
  },
  {
    family: 'auth',
    guarantee: 'workspace service keys isolate creators through rotation, revocation and membership changes',
    regression: 'a named integration reads another integration’s work or retains access after removal',
    run: workspaceServiceKeysIsolateCreators,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'official SDK clients see resource versions, creator visibility and archive conflicts',
    regression: 'SDK requests return a generic success envelope or disclose another creator’s agent',
    run: managedAgentLifecycle,
  },
  {
    family: 'managed',
    guarantee: 'SDK clients attach and rotate private repository access without exposing either credential',
    regression: 'a session returns an upstream Git token or attaches a repository outside the configured hosts',
    run: gitResourceCredentialsStayPrivate,
  },
  {
    family: 'managed',
    guarantee: 'verified OIDC roles scope resource visibility and environment administration',
    regression: 'invalid claims authorize requests or an OIDC caller sees another creator’s agent',
    run: managedOidcRolesScopeResources,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'an authenticated worker synchronizes only the memory stores mounted for its session',
    regression: 'a read-only or stale worker writes memory or silently loses updates',
    run: sharedMemoryIsScoped,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'the provider receives instructions only for memory mounted on that session',
    regression: 'an agent misses its memory mount or sees memory instructions belonging to another session',
    run: attachedMemoryGuidesProvider,
  },
  {
    family: 'managed',
    guarantee: 'separate sessions keep their event identities and context through interruption and restart',
    regression: 'a queued conversation inherits another session’s context or loses its replay position',
    run: sessionsReplayIndependently,
  },
  {
    family: 'managed',
    guarantee: 'large session inputs reach the provider intact and delegated tool results replay once after restart',
    regression:
      'an oversized input is truncated or a delegated result is lost or duplicated when its acknowledgement is lost',
    run: largeEventReplays,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'only opted-in readers see live response fragments that reconcile with the final message',
    regression: 'late readers replay model text or private thinking escapes through a preview',
    run: messagePreviewsReconcile,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'a coordinator routes a child tool result by its public ID and continues from the child report',
    regression:
      'a child waits forever, publishes duplicate events, or shares its private model context with its coordinator',
    run: coordinatorReceivesChildReport,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'a coordinator delegates to itself and revisits its child with isolated, retained context',
    regression: 'a same-identity handoff deadlocks, loses its follow-up, or opens a second child',
    run: coordinatorRevisitsSelf,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'isolated graders evaluate the deliverable and return actionable feedback to the same session',
    regression: 'grader output leaks as an agent reply, loses its span correlation, or never settles the outcome',
    run: outcomesReviseAndSettle,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'a session pauses new model requests at list cost and resumes its pending work after its cap changes',
    regression: 'a budget follows billed spend, blocks an already requested result, or loses the continuation',
    run: sessionBudgetResumes,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'native Messages sessions bill confirmed fast usage and surface a gateway speed mismatch',
    regression: 'a downgraded fast request produces a successful reply or a confirmed usage receipt',
    run: nativeGatewayConfirmsFastUsage,
  },
  {
    family: 'managed',
    canUseRetainedStack: true,
    guarantee: 'an environment worker executes its session’s tool and cannot read a sibling session',
    regression: 'a worker requires owner credentials, escapes session scope, or reports a fabricated result',
    run: scopedWorkerDeliversToolResult,
  },
  {
    family: 'compute',
    guarantee: 'an installed worker recovers a command across acknowledgement loss and control-plane restart',
    regression: 'a repeated delivery runs the external effect twice or loses its tool result',
    run: installedWorkerRecoversInterruptedCommand,
  },
  {
    family: 'context',
    guarantee: 'queued input completes with its own session context after interruption and restart',
    regression: 'an interrupted activation strands a queued input or omits conversation history on restart',
    run: queuedInputKeepsSessionContext,
  },
  {
    family: 'context',
    guarantee: 'compaction bounds model context while preserving session events, usage, and tool receipts',
    regression: 'a compacted session forgets results or reexecutes paid work after restart',
    run: compactionPreservesSession,
  },
  {
    family: 'runs',
    guarantee: 'a workspace spending limit governs admission before a session calls the model',
    regression: 'a session invokes the provider without funding or cannot resume after the allowance is restored',
    run: workspaceBudgetGuardsSession,
  },
  {
    family: 'runs',
    guarantee: 'an interrupted installed tool records its actual result once before the session redirects',
    regression: 'an interrupt fabricates the tool outcome, duplicates a shell effect, or strands pending input',
    run: installedWorkerFinishesInterruptedTool,
  },
  {
    family: 'runs',
    guarantee: 'an interruption and new input redirect a held session before its tool executes',
    regression: 'a stale request executes after interruption or leaves its replacement input waiting',
    run: interruptRedirectsSession,
  },
  {
    family: 'recovery',
    guarantee: 'an external tool result resumes its session once after restart while another session remains available',
    regression: 'waiting for an external result blocks the mech or duplicate results repeat its publication',
    run: customToolResultSurvivesRestart,
  },
  {
    family: 'recovery',
    guarantee: 'confirmed cleanup releases persistent ownership while preserving saved work',
    regression: 'a recovered cleanup leaves the owner lock behind and permanently blocks the next local start',
    run: confirmedCleanupReleasesPersistentOwnership,
  },
  {
    family: 'recovery',
    guarantee: 'imported Console history stays readable with valid identifiers and unchanged content',
    regression:
      'a migration preserves SQL rows but breaks the authenticated conversation response or its activity links',
    run: importedConversationRemainsReadable,
  },
  {
    family: 'recovery',
    guarantee: 'session replay stays within its authenticated workspace without repeating effects',
    regression: 'reconnection repeats model work, corrupts the message, or exposes another workspace',
    run: sessionEventsReplayWithinTheirWorkspace,
  },
  {
    family: 'recovery',
    guarantee: 'a failed provider request stays inspectable after restart without another model call',
    regression:
      'provider errors lose actionable diagnostics, disclose private fields, appear successful, or repeat model work on replay',
    run: sessionFailureRemainsInspectable,
  },
  {
    family: 'evals',
    canUseRetainedStack: true,
    guarantee: 'evaluations grade valid results without exposing expectations or repeating paid work',
    regression:
      'invalid grader output becomes a score, subjects see expectations, or a resumed evaluation repeats calls',
    run: gradesOnlyValidIsolatedEvaluations,
  },
  {
    family: 'compute',
    guarantee: 'installed sessions wait for a free physical machine and keep separate files',
    regression: 'zero or full capacity starts another guest or a successor sees the previous session’s files',
    timeoutMs: 360_000,
    run: installedCapacityProtectsPhysicalMachines,
  },
  {
    family: 'compute',
    guarantee: 'committed files and recovery receipts survive machine loss and replacement',
    regression:
      'machine loss discards committed files, bypasses a failed checkpoint fence, or rewrites a recovery receipt',
    timeoutMs: 660_000,
    run: checkpointedFilesSurviveMachineLoss,
  },
  {
    family: 'compute',
    guarantee: 'a background process retains its completion while unrelated foreground work remains available',
    regression: 'the process completion is lost, misattributed or repeated, or unrelated work is blocked',
    run: backgroundProcessKeepsItsCompletion,
  },
  {
    family: 'compute',
    guarantee: 'a stopped installed process remains inspectable after the environment is released',
    regression: 'released process state is lost or starts an unsolicited model request',
    run: stoppedProcessRemainsInspectable,
  },
  {
    family: 'compute',
    guarantee: 'installation drain preserves running and queued shell work through guest retirement',
    regression: 'shutdown checkpoints before admitted shell work completes or drops queued work',
    timeoutMs: 360_000,
    run: drainCompletesBeforePendingBash,
  },
  {
    family: 'compute',
    guarantee: 'a home with an archive over 512 MiB survives a drain and restore',
    regression: 'a large valid archive is refused or its restored files differ',
    timeoutMs: 660_000,
    run: largeHomeSurvivesRestore,
  },
  {
    family: 'compute',
    guarantee: 'a failed browser recording preserves the original environment and process',
    regression: 'a failed recording cleanup terminates the guest and loses unrelated work',
    timeoutMs: 360_000,
    run: recordingFailurePreservesEnvironment,
  },
  {
    family: 'compute',
    guarantee: 'execution grants are current and their credentials remain transient',
    regression: 'revoked execution access remains usable or resolved credentials become durable data',
    run: executionGrantIsCurrentAndTransient,
  },
  {
    family: 'compute',
    guarantee: 'managed MCP tools honor credential rotation and access revocation',
    regression: 'a remote tool receives a stale credential or remains callable after revocation',
    run: remoteToolGrantsHonorPolicy,
  },
  {
    family: 'security',
    guarantee: 'credentials stay out of durable execution records and logs',
    regression: 'actor persistence or diagnostics retain a resolved provider or user credential',
    run: credentialsStayOutOfDurableExecution,
  },
  {
    family: 'console',
    guarantee: 'Console hides a denied transcript in both open tabs and restores it after explicit readmission',
    regression: 'revoked session content remains visible in an open tab or stays hidden after readmission',
    run: consoleRevokesDeniedSession,
  },
  {
    family: 'console',
    guarantee: 'Console keeps session drafts isolated and sends each draft to the selected session',
    regression:
      'switching managed sessions loses a draft, misidentifies the active agent, or sends text to another session',
    run: consoleKeepsSessionDraftsIsolated,
  },
  {
    family: 'console',
    guarantee: 'Console opens, shares, and decodes screenshot and recording receipts from the selected managed session',
    regression: 'a receipt link loses its session, loads unrelated bytes, or stops working on reload',
    timeoutMs: 360_000,
    run: consoleOpensSessionEvidence,
  },
  {
    family: 'console',
    guarantee: 'Console restores durable agent and session records while refresh waits or fails',
    regression: 'a warm reload loses usable authorized records or hides refresh failure',
    run: consoleRetainsRecordsThroughRefreshFailure,
  },
] as const satisfies ReadonlyArray<Scenario>;

export type ScenarioFamily = (typeof CATALOG)[number]['family'];
