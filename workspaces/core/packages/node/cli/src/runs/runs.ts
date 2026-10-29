import type { Run } from '@mechane/cli-kernel';
import { runAuthLogin, runAuthLogout, runAuthStatus } from '@mechane/cli-login';
import { runUpdate } from '@mechane/cli-update';
import type { CommandName } from '@mechane/commands';
import { MechStatus, SandboxAction, WatchStatus } from '@mechane/protocol';
import { runConnectionCreate } from './connections/run-connection-create.ts';
import { runConnectionDelete } from './connections/run-connection-delete.ts';
import { runConnectionList } from './connections/run-connection-list.ts';
import { runConnectionUpdate } from './connections/run-connection-update.ts';
import { runGrantList } from './connections/run-grant-list.ts';
import { runGrantRevoke } from './connections/run-grant-revoke.ts';
import { runGrantSet } from './connections/run-grant-set.ts';
import { documentRun } from './document-run.ts';
import { runDroneCancel } from './drones/run-drone-cancel.ts';
import { runDroneList } from './drones/run-drone-list.ts';
import { runDroneShow } from './drones/run-drone-show.ts';
import { runThreadList } from './drones/run-thread-list.ts';
import { runKeyCreate } from './keys/run-key-create.ts';
import { runKeyList } from './keys/run-key-list.ts';
import { runKeyRevoke } from './keys/run-key-revoke.ts';
import { runInboxSend } from './mechs/run-inbox-send.ts';
import { runMechChange } from './mechs/run-mech-change.ts';
import { runMechClone } from './mechs/run-mech-clone.ts';
import { runMechCreate } from './mechs/run-mech-create.ts';
import { runMechFork } from './mechs/run-mech-fork.ts';
import { runMechList } from './mechs/run-mech-list.ts';
import { runMechRevisions } from './mechs/run-mech-revisions.ts';
import { runMechShow } from './mechs/run-mech-show.ts';
import { runTurnCancel } from './mechs/run-turn-cancel.ts';
import { runEventList } from './observe/run-event-list.ts';
import { runMemoryList } from './observe/run-memory-list.ts';
import { runTurnShow } from './observe/run-turn-show.ts';
import { runEvalRun } from './run-eval-run.ts';
import { runReadiness } from './run-readiness.ts';
import { runSandboxChange } from './sandboxes/run-sandbox-change.ts';
import { runSandboxExport } from './sandboxes/run-sandbox-export.ts';
import { runSandboxImport } from './sandboxes/run-sandbox-import.ts';
import { runSandboxShow } from './sandboxes/run-sandbox-show.ts';
import { runSlackBind } from './slack/run-slack-bind.ts';
import { runSlackBindings } from './slack/run-slack-bindings.ts';
import { runSlackDeliveries } from './slack/run-slack-deliveries.ts';
import { runSource } from './sources/run-source.ts';
import { runFindingList } from './watches/run-finding-list.ts';
import { runWatchList } from './watches/run-watch-list.ts';
import { runWatchSet } from './watches/run-watch-set.ts';
import { runWatchStatus } from './watches/run-watch-status.ts';
import { WORKSPACE_RUNS } from './workspaces/workspace-runs.ts';

/** The run of each command; a command without one fails to compile. */
type Runs = { readonly [N in CommandName]: Run<N> };

/** The run of each command; a command without one fails to compile. Only a command that streams writes as it goes. */
export const RUNS: Readonly<Runs> = {
  'source grant': documentRun<'source grant'>({ run: runSource }),
  'source revoke': documentRun<'source revoke'>({ run: runSource }),
  'source checkout': documentRun<'source checkout'>({ run: runSource }),
  'source publish': documentRun<'source publish'>({ run: runSource }),
  'source show': documentRun<'source show'>({ run: runSource }),
  'watch set': documentRun({ run: runWatchSet }),
  'watch list': documentRun({ run: runWatchList }),
  'watch pause': documentRun({ run: (input) => runWatchStatus({ ...input, status: WatchStatus.Paused }) }),
  'watch resume': documentRun({ run: (input) => runWatchStatus({ ...input, status: WatchStatus.Active }) }),
  'finding list': documentRun({ run: runFindingList }),
  'slack bind': documentRun({ run: runSlackBind }),
  'slack bindings': documentRun({ run: runSlackBindings }),
  'slack deliveries': documentRun({ run: runSlackDeliveries }),
  'connection create': documentRun({ run: runConnectionCreate }),
  'connection update': documentRun({ run: runConnectionUpdate }),
  'connection list': documentRun({ run: runConnectionList }),
  'connection delete': documentRun({ run: runConnectionDelete }),
  'grant set': documentRun({ run: runGrantSet }),
  'grant list': documentRun({ run: runGrantList }),
  'grant revoke': documentRun({ run: runGrantRevoke }),

  'sandbox show': documentRun({ run: runSandboxShow }),
  'sandbox export': documentRun({ run: runSandboxExport }),
  'sandbox import': documentRun({ run: runSandboxImport }),
  'sandbox upgrade': documentRun({ run: (input) => runSandboxChange({ ...input, action: SandboxAction.Upgrade }) }),
  'sandbox delete': documentRun({ run: (input) => runSandboxChange({ ...input, action: SandboxAction.Delete }) }),
  'sandbox cancel': documentRun({ run: (input) => runSandboxChange({ ...input, action: SandboxAction.Cancel }) }),
  'readiness': documentRun({ run: runReadiness }),
  'auth login': documentRun({ run: runAuthLogin }),
  'auth status': documentRun({ run: runAuthStatus }),
  'auth logout': documentRun({ run: runAuthLogout }),
  'key create': documentRun({ run: runKeyCreate }),
  'key list': documentRun({ run: runKeyList }),
  'key revoke': documentRun({ run: runKeyRevoke }),
  ...WORKSPACE_RUNS,
  'mech create': documentRun({ run: runMechCreate }),
  'mech list': documentRun({ run: runMechList }),
  'mech fork': documentRun({ run: runMechFork }),
  'mech clone': documentRun({ run: runMechClone }),
  'mech show': documentRun({ run: runMechShow }),
  'mech update': documentRun({ run: runMechChange }),
  'mech rename': documentRun({ run: runMechChange }),
  'mech pause': documentRun({
    run: (input) => runMechChange({ ...input, input: { ...input.input, status: MechStatus.Paused } }),
  }),
  'mech resume': documentRun({
    run: (input) => runMechChange({ ...input, input: { ...input.input, status: MechStatus.Active } }),
  }),
  'mech archive': documentRun({
    run: (input) => runMechChange({ ...input, input: { ...input.input, status: MechStatus.Archived } }),
  }),
  'mech revisions': documentRun({ run: runMechRevisions }),
  'inbox send': documentRun({ run: runInboxSend }),
  'event list': runEventList,
  'turn show': documentRun({ run: runTurnShow }),
  'turn cancel': documentRun({ run: runTurnCancel }),
  'memory list': documentRun({ run: runMemoryList }),
  'thread list': documentRun({ run: runThreadList }),
  'drone list': documentRun({ run: runDroneList }),
  'drone show': documentRun({ run: runDroneShow }),
  'drone cancel': documentRun({ run: runDroneCancel }),
  'eval run': runEvalRun,
  'update': documentRun({ run: runUpdate }),
};
