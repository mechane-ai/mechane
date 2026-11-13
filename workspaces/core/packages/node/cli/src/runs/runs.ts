import type { Run } from '@mechane/cli-kernel';
import { runAuthLogin, runAuthLogout, runAuthStatus } from '@mechane/cli-login';
import { runUpdate } from '@mechane/cli-update';
import type { CommandName } from '@mechane/commands';
import { MechStatus, SandboxAction } from '@mechane/protocol';
import { runConnectionCreate } from './connections/run-connection-create.ts';
import { runConnectionDelete } from './connections/run-connection-delete.ts';
import { runConnectionList } from './connections/run-connection-list.ts';
import { runConnectionUpdate } from './connections/run-connection-update.ts';
import { runGrantList } from './connections/run-grant-list.ts';
import { runGrantRevoke } from './connections/run-grant-revoke.ts';
import { runGrantSet } from './connections/run-grant-set.ts';
import { runCredentialDelete } from './credentials/run-credential-delete.ts';
import { runCredentialList } from './credentials/run-credential-list.ts';
import { runCredentialPut } from './credentials/run-credential-put.ts';
import { documentRun } from './document-run.ts';
import { runExecutionAccessSet } from './execution-access/run-execution-access-set.ts';
import { runExecutionAccessShow } from './execution-access/run-execution-access-show.ts';
import { runKeyCreate } from './keys/run-key-create.ts';
import { runKeyList } from './keys/run-key-list.ts';
import { runKeyRevoke } from './keys/run-key-revoke.ts';
import { runMechChange } from './mechs/run-mech-change.ts';
import { runMechClone } from './mechs/run-mech-clone.ts';
import { runMechCreate } from './mechs/run-mech-create.ts';
import { runMechFork } from './mechs/run-mech-fork.ts';
import { runMechList } from './mechs/run-mech-list.ts';
import { runMechRevisions } from './mechs/run-mech-revisions.ts';
import { runMechShow } from './mechs/run-mech-show.ts';
import { runNotificationSend } from './mechs/run-notification-send.ts';
import { runTurnCancel } from './mechs/run-turn-cancel.ts';
import { runEventList } from './observe/run-event-list.ts';
import { runTurnShow } from './observe/run-turn-show.ts';
import { runRoutineDelete, runRoutineList, runRoutinePut, runRoutineShow } from './routines/routine-runs.ts';
import { runEvalRun } from './run-eval-run.ts';
import { runReadiness } from './run-readiness.ts';
import { runSandboxChange } from './sandboxes/run-sandbox-change.ts';
import { runSandboxRestore } from './sandboxes/run-sandbox-restore.ts';
import { runSandboxShow } from './sandboxes/run-sandbox-show.ts';
import {
  runSelfMessage,
  runSelfWakeCancel,
  runSelfWakeList,
  runSelfWakeSchedule,
  runSelfWakeShow,
} from './self/self-runs.ts';
import { WORKSPACE_RUNS } from './workspaces/workspace-runs.ts';

/** The run of each command; a command without one fails to compile. */
type Runs = { readonly [N in CommandName]: Run<N> };

/** The run of each command; a command without one fails to compile. Only a command that streams writes as it goes. */
export const RUNS: Readonly<Runs> = {
  'execution-access show': documentRun({ run: runExecutionAccessShow }),
  'execution-access set': documentRun({ run: runExecutionAccessSet }),
  'credential put': documentRun({ run: runCredentialPut }),
  'credential list': documentRun({ run: runCredentialList }),
  'credential delete': documentRun({ run: runCredentialDelete }),
  'connection create': documentRun({ run: runConnectionCreate }),
  'connection update': documentRun({ run: runConnectionUpdate }),
  'connection list': documentRun({ run: runConnectionList }),
  'connection delete': documentRun({ run: runConnectionDelete }),
  'grant set': documentRun({ run: runGrantSet }),
  'grant list': documentRun({ run: runGrantList }),
  'grant revoke': documentRun({ run: runGrantRevoke }),

  'sandbox show': documentRun({ run: runSandboxShow }),
  'sandbox restore': documentRun({ run: runSandboxRestore }),
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
  'notification send': documentRun({ run: runNotificationSend }),
  'routine put': documentRun({ run: runRoutinePut }),
  'routine show': documentRun({ run: runRoutineShow }),
  'routine list': documentRun({ run: runRoutineList }),
  'routine delete': documentRun({ run: runRoutineDelete }),
  'self wake schedule': documentRun({ run: runSelfWakeSchedule }),
  'self wake show': documentRun({ run: runSelfWakeShow }),
  'self wake list': documentRun({ run: runSelfWakeList }),
  'self wake cancel': documentRun({ run: runSelfWakeCancel }),
  'self message': documentRun({ run: runSelfMessage }),
  'event list': runEventList,
  'turn show': documentRun({ run: runTurnShow }),
  'turn cancel': documentRun({ run: runTurnCancel }),
  'eval run': runEvalRun,
  'update': documentRun({ run: runUpdate }),
};
