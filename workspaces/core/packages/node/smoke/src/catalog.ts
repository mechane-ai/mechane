import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import type { Effect } from 'effect';
import { deadKeysAreRefusedWithTheirOwnCode } from './auth/dead-keys-are-refused-with-their-own-code.ts';
import { firstLoginSignsUpAndLaterLoginsReuseIt } from './auth/first-login-signs-up-and-later-logins-reuse-it.ts';
import { noKeyApprovesTheCreationOfAKey } from './auth/no-key-approves-the-creation-of-a-key.ts';
import { onlyTheTypedCodeIsApprovedAndWrongCodesAreThrottled } from './auth/only-the-typed-code-is-approved-and-wrong-codes-are-throttled.ts';
import { tokensStayInTheirCredentialFiles } from './auth/tokens-stay-in-their-credential-files.ts';
import { cloudflareRestoresWorkspace } from './deployment/cloudflare-restores-workspace.ts';
import { freshStackServesStagedWorker } from './deployment/fresh-stack-serves-staged-worker.ts';
import { droneReadsMemoryAsSavedAtItsStart } from './drones/drone-reads-memory-as-saved-at-its-start.ts';
import { droneReportsOnceThroughTheInbox } from './drones/drone-reports-once-through-the-inbox.ts';
import { evalRunGradesEachCaseThroughTheDeployment } from './evals/eval-run-grades-each-case-through-the-deployment.ts';
import { forkedMechKeepsItsParentsPastAndNoLaterTurn } from './forks/forked-mech-keeps-its-parents-past-and-no-later-turn.ts';
import { interruptedCommandRunsOnce } from './hands/interrupted-command-runs-once.ts';
import { mechClonesARepositoryIntoItsOwnSandbox } from './hands/mech-clones-a-repository-into-its-own-sandbox.ts';
import { burstFromOneAddressIsRefusedAndOthersAreServed } from './limits/burst-from-one-address-is-refused-and-others-are-served.ts';
import { inboxItemIsAnsweredAndChargedOnce } from './mechs/inbox-item-is-answered-and-charged-once.ts';
import { uncoverableDispatchIsRefusedUnsent } from './mechs/uncoverable-dispatch-is-refused-unsent.ts';
import { canceledTurnSavesNoMemory } from './memory/canceled-turn-saves-no-memory.ts';
import { savedMemoryOutlivesARestartAndAReset } from './memory/saved-memory-outlives-a-restart-and-a-reset.ts';
import { installedCliUpdatesToThePublishedRelease } from './releases/installed-cli-updates-to-the-published-release.ts';
import { workspacePolicyCutsOffQueuedWorkImmediately } from './workspaces/workspace-policy-cuts-off-queued-work-immediately.ts';

/** One scenario of the smoke and the consequential regression it guards. */
type Scenario = {
  readonly guarantee: string;
  readonly regression: string;
  readonly run: (input: ScenarioInput) => Effect.Effect<void, ScenarioFailure>;
};

/**
 * The scenario catalog: every scenario the smoke runs, each guarding one consequential regression. Scott approves each
 * change to this list. The mech scenarios run early: a follower's last wait for an event ends only at its deadline, 20
 * seconds on, and the stack stops only once every wait has ended. Restart scenarios end prior waits and restore their
 * temporary installation settings. Workspace policy checks use runtime APIs while agents keep running. The token scan
 * runs last, so it reads the stored state and the sandboxes every other scenario left.
 */
export const CATALOG: ReadonlyArray<Scenario> = [
  {
    guarantee:
      'the built Worker restores sandbox files after export, import, machine replacement, and a Cloudflare workerd restart',
    regression:
      'runtime compatibility: sandbox commands or portable file restoration that pass locally but fail under Cloudflare workerd',
    run: cloudflareRestoresWorkspace,
  },
  {
    guarantee: 'a fresh stack serves the staged Worker, whose readiness reports its revision and each migrated class',
    regression: 'publication safety: a Worker build or Durable Object migration that cannot serve a fresh deployment',
    run: freshStackServesStagedWorker,
  },
  {
    guarantee: 'an inbox item is answered through the model and charged once',
    regression:
      'model metering: a reply that never comes, a dispatch charged at other than its reported usage, or a resent inbox item that runs and is charged again',
    run: inboxItemIsAnsweredAndChargedOnce,
  },
  {
    guarantee:
      'a dispatch the allowance cannot cover is refused before the upstream receives it, and its turn ends allowance_exhausted',
    regression: 'spend control: a dispatch sent beyond the daily allowance, or a refusal that reads as a failed model',
    run: uncoverableDispatchIsRefusedUnsent,
  },
  {
    guarantee:
      'an eval run grades each case through the deployment, an answer that is not a grade is recorded as no_grade, never as a score, and its subject never sees an expectation',
    regression:
      "eval integrity: a grader's text answer counted as a score, or a trial graded without the deployment's turns",
    run: evalRunGradesEachCaseThroughTheDeployment,
  },
  {
    guarantee:
      'a mech clones a public repository with bash, its next turn still finds the clone, and its sandbox holds only its own files and variables',
    regression:
      "sandbox isolation: a command that never runs or loses its output, a sandbox that forgets its files between turns, or one that another mech shares or that sees the stack's variables",
    run: mechClonesARepositoryIntoItsOwnSandbox,
  },
  {
    guarantee:
      'a canceled turn saves none of its memory changes, whether a member or an interrupt item cancels it, and the items sent during it still get their turns',
    regression:
      'turn atomicity: a canceled turn whose memory changes land or show, a cancel that never ends its turn or strands the item queued behind it, or an interrupt item that waits for the turn it should cancel',
    run: canceledTurnSavesNoMemory,
  },
  {
    guarantee:
      'a memory a mech saves is recalled after a restart of the deployment and a reset of its context, from its memory and not its transcript',
    regression:
      "lost memory: a memory that a restart loses, that lives only in the conversation's context, or that a reset leaves out of the mech's prompt",
    run: savedMemoryOutlivesARestartAndAReset,
  },
  {
    guarantee:
      "a forked mech keeps its parent's memory and conversation up to the fork, and later turns of either never reach the other",
    regression:
      "fork isolation: a fork that loses its parent's memory or conversation, shares later memory, events or requests with its parent, or reuses its parent's provider identity so their model caches mix",
    run: forkedMechKeepsItsParentsPastAndNoLaterTurn,
  },
  {
    guarantee: "a drone reads its mech's memory as saved when it started, and can neither change it nor start a drone",
    regression:
      "drone confinement: a drone that reads a running turn's changes or a save made after its start, that writes its mech's memory, or that starts drones of its own",
    run: droneReadsMemoryAsSavedAtItsStart,
  },
  {
    guarantee:
      'a drone runs in its own sandbox and reports back through the inbox exactly once, whether it finishes, a member cancels it, or a restart interrupts it',
    regression:
      "drone reporting: a drone that shares its mech's sandbox, runs its command again or reports twice or never after a restart, charges its dispatches to no drone, or runs on past a member's cancel",
    run: droneReportsOnceThroughTheInbox,
  },
  {
    guarantee:
      'a command that a crash interrupts runs once, also across alarms that hand its turn on, and its output still reaches the mech; a reply streaming at a hand-off is sent and charged once',
    regression:
      'run-once execution: a command that a restart of the deployment runs a second time, or whose output it loses, or an alarm hand-off that runs a command again or cuts and re-sends a dispatch',
    run: interruptedCommandRunsOnce,
  },
  {
    guarantee:
      'workspace policy takes effect without a deployment: disabled sandboxes start no machines, suspended work spends nothing, and budget reductions govern the next dispatch',
    regression:
      'operator control: workspace policy waits for an agent restart, a suspended workspace still admits calls or dispatches, or a workspace owner changes installation policy',
    run: workspacePolicyCutsOffQueuedWorkImmediately,
  },
  {
    guarantee:
      'a fresh GitHub identity signs up through device login with exactly one personal workspace, which a second login reuses',
    regression:
      'open sign-up: a login that creates no workspace, a second one, or a second principal for one GitHub identity',
    run: firstLoginSignsUpAndLaterLoginsReuseIt,
  },
  {
    guarantee: 'a logged-out or expired key is refused with its own code',
    regression: 'key lifecycle: a logout that leaves its key live, or an expired key that authenticates',
    run: deadKeysAreRefusedWithTheirOwnCode,
  },
  {
    guarantee: 'a key cannot approve the creation of a key',
    regression: 'key lifecycle: a key that approves a device approval, so one key mints another without a browser',
    run: noKeyApprovesTheCreationOfAKey,
  },
  {
    guarantee: 'an approval goes through only for the code its signed-in approver types, and wrong codes are throttled',
    regression:
      'device-code phishing: a link that fills in the code, a review without its CSRF token, a code whose answer tells pending from expired, or unthrottled guessing',
    run: onlyTheTypedCodeIsApprovedAndWrongCodesAreThrottled,
  },
  {
    guarantee:
      'a burst from one address at the public endpoints is refused with a decodable 429, also after a restart, and other addresses are still served',
    regression:
      'public abuse: an unauthenticated burst that reaches the directory unbounded, a limit shared by every address or forgotten by a restart or an eviction, or a refusal without its wait',
    run: burstFromOneAddressIsRefusedAndOthersAreServed,
  },
  {
    guarantee: 'an installed CLI updates itself to the release its deployment publishes',
    regression:
      'CLI distribution: an install.sh or mechane update that installs a binary other than the published release, or a release that never reaches an installed CLI',
    run: installedCliUpdatesToThePublishedRelease,
  },
  {
    guarantee:
      "no raw token appears in stored Durable Object state, a sandbox, the Worker log or command output, only in the credential files, and the Worker's log holds only id-only lines, never a mech's text or command",
    regression:
      "secret handling: a key, poll, session, sign-in or GitHub token, the model upstream's key or the host launcher's, that the deployment stores, logs, prints or passes into a sandbox, or a mech's text or command that it logs",
    run: tokensStayInTheirCredentialFiles,
  },
];
