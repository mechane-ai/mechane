import { RequestInvalid, ServiceUnavailable } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import {
  SandboxCompletionKind,
  sandboxCompletionPath,
  SandboxCompletionReceipt,
  SandboxCompletionStatus,
} from '@mechane/sandbox-wire';
import type { SandboxCompletion } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import type { RuntimeConfiguration } from '../config.ts';
import type { ExecutionReceipt } from '../domain.ts';
import { executionId } from '../execution-id.ts';
import type { RuntimeStore } from '../store/database.ts';
import { ProcessStartReceipt } from '../tools/processes/results.ts';
import { requestSandboxJson } from '../tools/sandbox-transport.ts';
import { wakeMech } from './notifications.ts';
import type { StartAdmission } from './types.ts';

const COMPLETION_MAX_BYTES = 4096;
const ACTIVE_RUN_STATUSES: ReadonlySet<string> = new Set(['queued', 'running', 'waiting']);

const TERMINAL_PROCESS_STATUSES: ReadonlySet<string> = new Set([
  SandboxCompletionStatus.Exited,
  SandboxCompletionStatus.Stopped,
  SandboxCompletionStatus.Lost,
]);

export async function acceptSandboxCompletion({
  store,
  configuration,
  startAdmission,
  completion,
}: {
  readonly store: RuntimeStore;
  readonly configuration: RuntimeConfiguration;
  readonly startAdmission: StartAdmission;
  readonly completion: SandboxCompletion;
}): Promise<void> {
  const { workspaceId, mechId, ...reported } = completion;
  const receipt = await store.getExecution({ id: completion.executionId, workspaceId, mechId });

  if (receipt === null || receipt.kind !== completion.kind) {
    throw new RequestInvalid({ reason: 'The completion has no matching execution receipt' });
  }

  const body = await requestSandboxJson({
    configuration,
    url: new URL(sandboxCompletionPath(completion), configuration.sandbox.origin),
    method: HttpMethod.Get,
    body: null,
    maximumBytes: COMPLETION_MAX_BYTES,
  });

  const observed = Schema.decodeUnknownSync(SandboxCompletionReceipt)(body);

  if (!isDeepStrictEqual(observed, reported)) {
    throw new RequestInvalid({ reason: 'The completion does not match its environment receipt' });
  }

  if (completionWasObserved({ receipt, completion }) || receipt.result?.['purpose'] === 'note_import') {
    return;
  }

  if (
    receipt.status === 'pending' ||
    (receipt.kind === SandboxCompletionKind.Process && receipt.status === 'running')
  ) {
    const run = await store.getRun({ runId: receipt.runId });

    if (run !== null && ACTIVE_RUN_STATUSES.has(run.status)) {
      throw new ServiceUnavailable({ reason: 'The active tool is still recording its execution outcome' });
    }
  }

  const id = await executionId({ runId: receipt.runId, toolCallId: `completion:${receipt.id}` });
  let exit = '';

  if (Option.isSome(completion.exitCode)) {
    exit = `, exit code ${String(completion.exitCode.value)}`;
  }

  const result = Schema.encodeSync(SandboxCompletionReceipt)(reported);

  await store.admitNotification({
    id,
    workspaceId,
    mechId,
    text: `Execution ${receipt.id} finished: ${completion.status}${exit}. Its retained output is available through the environment tools.`,
    source: { name: 'environment', eventId: receipt.id },
    producer: { kind: 'producer', id: 'mechane-environment' },
    data: { ...result, runId: receipt.runId },
  });

  await wakeMech({ store, startAdmission, workspaceId, mechId });
}

function completionWasObserved({
  receipt,
  completion,
}: {
  readonly receipt: ExecutionReceipt;
  readonly completion: SandboxCompletion;
}): boolean {
  if (receipt.status !== 'completed') {
    return false;
  }

  if (receipt.kind === SandboxCompletionKind.Process) {
    // A completed start operation can still leave its process running.
    const outcome = ProcessStartReceipt.parse(receipt.result).outcome;

    const isSameProcess =
      outcome.processId === completion.executionId && outcome.machineId === Option.getOrUndefined(completion.machineId);

    const isSameOutcome =
      outcome.status === completion.status && outcome.exitCode === Option.getOrUndefined(completion.exitCode);

    return TERMINAL_PROCESS_STATUSES.has(outcome.status) && isSameProcess && isSameOutcome;
  }

  return true;
}
