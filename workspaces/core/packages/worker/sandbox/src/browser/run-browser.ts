import { MachineId } from '@mechane/records';
import type { BrowserCall } from '@mechane/sandbox-store';
import { BrowserAction, BrowserProgress } from '@mechane/sandbox-wire';
import type { BrowserRequest } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { connectLiveMachine } from '../machines/connect-live-machine.ts';
import { readyInteractiveMachine } from '../machines/ready-interactive-machine.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';
import { releaseWorkspace } from '../workspace/release-workspace.ts';
import { browserGuest } from './browser-guest.ts';
import { browserProgress, completedBrowserProgress } from './browser-progress.ts';

type RunBrowserInput = WorkspaceProviderStepInput & Pick<BrowserRequest, 'requestId'>;
type AssignBrowserInput = WorkspaceProviderStepInput & { readonly call: BrowserCall };

/** Only a new Open can allocate; every other action and every retry keeps its original browser machine. */
export async function runBrowser({ store, provider, workspace, requestId }: RunBrowserInput): Promise<BrowserProgress> {
  const call = store.requiredBrowserCall({ requestId });
  const completed = browserProgress({ call });

  if (Option.isSome(completed)) {
    return completed.value;
  }

  const input = { store, provider, workspace };

  if (!(await advanceWorkspace(input))) {
    return BrowserProgress.cases.Pending.make({ reason: 'the sandbox is completing a file checkpoint' });
  }

  const assigned = await assignBrowserMachine({ ...input, call });
  const terminal = browserProgress({ call: assigned });

  if (Option.isSome(terminal)) {
    return terminal.value;
  }

  if (Option.isNone(assigned.machineId)) {
    return BrowserProgress.cases.Pending.make({ reason: 'the browser machine is starting or restoring files' });
  }

  const machineId = assigned.machineId.value;
  const guest = await connectLiveMachine({ store, provider, machineId });

  if (Option.isNone(guest)) {
    return loseBrowserCall({ store, requestId });
  }

  const drain = store.machineDrain({ machineId });

  if (Option.isSome(drain)) {
    return BrowserProgress.cases.Pending.make({ reason: 'the original browser machine is draining before shutdown' });
  }

  const isReleased = await releaseWorkspace({ ...input, machineId, guest: guest.value });

  if (!isReleased) {
    return BrowserProgress.cases.Pending.make({
      reason: 'the browser is waiting for its completed workspace checkpoint to release',
    });
  }

  const latest = store.requiredBrowserCall({ requestId });
  const canceled = browserProgress({ call: latest });

  if (Option.isSome(canceled)) {
    return canceled.value;
  }

  const result = await browserGuest({ guest: guest.value, machineId, request: assigned.request });

  if (BrowserProgress.guards.Pending(result)) {
    return result;
  }

  if (BrowserProgress.guards.Ready(result)) {
    store.saveBrowserResponse({ machineId, response: result.response });
  } else {
    const isUncertain = BrowserProgress.guards.Uncertain(result);

    store.failBrowserCall({ requestId, reason: result.reason, isUncertain });
  }

  const recorded = store.requiredBrowserCall({ requestId });

  return completedBrowserProgress({ call: recorded });
}

async function assignBrowserMachine({ store, provider, workspace, call }: AssignBrowserInput): Promise<BrowserCall> {
  if (Option.isSome(call.machineId)) {
    return call;
  }

  const { requestId, action } = call.request;

  if (BrowserAction.guards.Open(action)) {
    const machine = await readyInteractiveMachine({ store, provider, workspace });

    if (Option.isNone(machine)) {
      return call;
    }

    const decoded = Schema.decodeUnknownResult(MachineId)(machine.value.id);
    const machineId = Result.getOrThrow(decoded);

    return store.assignBrowserCall({ requestId, machineId });
  }

  const machineId: Option.Option<MachineId> = (() => {
    if ('tabId' in action) {
      return store.browserTabMachine({ tabId: action.tabId });
    }

    return store.browserMachine();
  })();

  if (Option.isSome(machineId)) {
    return store.assignBrowserCall({ requestId, machineId: machineId.value });
  }

  store.failBrowserCall({
    requestId,
    reason: 'no browser or tab matches this action; open a new tab first',
    isUncertain: false,
  });

  return store.requiredBrowserCall({ requestId });
}

type LostBrowserCallInput = Pick<RunBrowserInput, 'store' | 'requestId'>;

function loseBrowserCall({ store, requestId }: LostBrowserCallInput): BrowserProgress {
  const reason = 'the original browser machine was lost; the action was not replayed';

  store.failBrowserCall({ requestId, reason, isUncertain: true });

  return BrowserProgress.cases.Uncertain.make({ reason });
}
