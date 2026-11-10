import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { RequestInvalid, ServiceUnavailable } from '@mechane/protocol';
import { toolExecutionId as executionId, HttpMethod } from '@mechane/records';
import {
  SandboxCompletion,
  SandboxCompletionKind,
  sandboxCompletionPath,
  SandboxCompletionReceipt,
  SandboxCompletionStatus,
} from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import { Effects, ImportedCompletions, Turns } from '../actor/collections.ts';
import type { EffectRecord } from '../actor/record-schemas.ts';
import { decodeStored, RunRecord } from '../actor/records.ts';
import { stableJson } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';
import { admitNotification } from '../notifications/admission.ts';
import { ProcessStartReceipt } from '../tools/processes/results.ts';
import { requestSandboxJson } from '../tools/sandbox-transport.ts';

const COMPLETION_MAX_BYTES = 4096;
const ACTIVE_RUN_STATUSES: ReadonlySet<string> = new Set(['queued', 'running', 'waiting']);
const ACTIVE_RECEIPT_STATUSES: ReadonlySet<EffectRecord['status']> = new Set(['pending', 'running']);

const TERMINAL_PROCESS_STATUSES: ReadonlySet<string> = new Set([
  SandboxCompletionStatus.Exited,
  SandboxCompletionStatus.Stopped,
  SandboxCompletionStatus.Lost,
]);

function completionWasObserved(input: {
  readonly receipt: EffectRecord;
  readonly completion: SandboxCompletion;
}): boolean {
  if (input.receipt.status !== 'completed') {
    return false;
  }

  if (input.receipt.kind !== SandboxCompletionKind.Process) {
    return true;
  }

  if (input.receipt.result === null) {
    return false;
  }

  const outcome = ProcessStartReceipt.parse(JSON.parse(input.receipt.result)).outcome;

  if (!TERMINAL_PROCESS_STATUSES.has(outcome.status)) {
    return false;
  }

  const hasSameProcess =
    outcome.processId === input.completion.executionId &&
    outcome.machineId === Option.getOrUndefined(input.completion.machineId);

  if (!hasSameProcess) {
    return false;
  }

  return (
    outcome.status === input.completion.status && outcome.exitCode === Option.getOrUndefined(input.completion.exitCode)
  );
}

export async function acceptCompletion(access: ActorAccess, completion: SandboxCompletion): Promise<void> {
  if (completion.workspaceId !== access.scope.workspaceId || completion.mechId !== access.scope.mechId) {
    throw new RequestInvalid({ reason: 'The completion belongs to another mech' });
  }

  const receipt = await Effects.get(access.harness, completion.executionId, BACKGROUND_CONTEXT);
  const archived = await ImportedCompletions.get(access.harness, completion.executionId, BACKGROUND_CONTEXT);

  if (receipt === undefined && archived === undefined) {
    throw new RequestInvalid({ reason: 'The completion has no matching execution receipt' });
  }

  if (receipt !== undefined && receipt.kind !== completion.kind) {
    throw new RequestInvalid({ reason: 'The completion kind differs from its execution receipt' });
  }

  const encoded = Schema.encodeSync(SandboxCompletion)(completion);

  if (archived !== undefined && stableJson(archived) !== stableJson(encoded)) {
    throw new RequestInvalid({ reason: 'The completion differs from its archived terminal receipt' });
  }

  const { workspaceId: _workspaceId, mechId: _mechId, ...reported } = completion;

  const observed = await requestSandboxJson({
    configuration: access.configuration,
    url: new URL(sandboxCompletionPath(completion), access.configuration.sandbox.origin),
    method: HttpMethod.Get,
    body: null,
    maximumBytes: COMPLETION_MAX_BYTES,
  });

  const retained = Schema.encodeSync(SandboxCompletionReceipt)(
    Schema.decodeUnknownSync(SandboxCompletionReceipt)(observed),
  );

  if (stableJson(retained) !== stableJson(Schema.encodeSync(SandboxCompletionReceipt)(reported))) {
    throw new RequestInvalid({ reason: 'The completion differs from its durable environment receipt' });
  }

  if (archived !== undefined || receipt?.runtimeSource === 'imported') {
    return;
  }

  if (receipt === undefined) {
    throw new RequestInvalid({ reason: 'The native completion has no execution owner' });
  }

  if (completionWasObserved({ receipt, completion })) {
    return;
  }

  const turn = await Turns.get(access.harness, receipt.runId, BACKGROUND_CONTEXT);

  if (turn !== undefined) {
    const run = decodeStored(RunRecord, turn.value);

    if (receipt.kind === SandboxCompletionKind.Sandbox && run.cancelRequestedAt !== null) {
      return;
    }

    if (ACTIVE_RECEIPT_STATUSES.has(receipt.status) && ACTIVE_RUN_STATUSES.has(run.status)) {
      throw new ServiceUnavailable({ reason: 'The active tool is still recording its execution outcome' });
    }
  }

  const id = await executionId({ runId: receipt.runId, toolCallId: `completion:${receipt.id}` });
  let exit = '';

  if (Option.isSome(completion.exitCode)) {
    exit = `, exit code ${String(completion.exitCode.value)}`;
  }

  await admitNotification(access, {
    id,
    text: `Execution ${receipt.id} finished: ${completion.status}${exit}. Its retained output is available through the environment tools.`,
    source: { name: 'environment', eventId: receipt.id },
    producer: { kind: 'producer', id: 'mechane-environment' },
    data: { ...retained, runId: receipt.runId },
  });
}
