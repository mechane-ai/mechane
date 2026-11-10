import { HttpHeader, HttpMethod } from '@mechane/records';
import {
  sandboxExecutionCancelPath,
  SandboxExecutionIdentity,
  sandboxInteractiveCancelPath,
  SandboxRunIdentity,
} from '@mechane/sandbox-wire';
import { Redacted, Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import { TOOL_REQUEST_TIMEOUT_MS } from './constants.ts';
import { toolConfiguration, withToolStore } from './context.ts';
import { rejectRedirect } from './http.ts';

type CancelRunExecutionsInput = { readonly runId: string; readonly workspaceId: string };

export type ExecutionCancellation = {
  readonly cancelledIds: ReadonlyArray<string>;
  readonly unconfirmedIds: ReadonlyArray<string>;
};

const FINAL_RECEIPT_STATES: ReadonlySet<string> = new Set(['completed', 'failed']);

export async function cancelRunExecutions(input: CancelRunExecutionsInput): Promise<ExecutionCancellation> {
  await cancelInteractiveRun(input);

  const receipts = await withToolStore((store) => store.listRunExecutions(input));
  const configuration = toolConfiguration();
  const cancelledIds: Array<string> = [];
  const unconfirmedIds: Array<string> = [];

  const active = receipts.filter((receipt) => receipt.kind === 'sandbox' && !FINAL_RECEIPT_STATES.has(receipt.status));

  for (const receipt of active) {
    const identity = Schema.decodeUnknownSync(SandboxExecutionIdentity)({
      workspaceId: input.workspaceId,
      mechId: receipt.mechId,
      executionId: receipt.id,
    });

    const path = sandboxExecutionCancelPath(identity);

    try {
      const isConfirmed = await requestCancellation({ configuration, path });

      if (isConfirmed) {
        cancelledIds.push(receipt.id);
      } else {
        unconfirmedIds.push(receipt.id);
      }
    } catch {
      unconfirmedIds.push(receipt.id);
    }
  }

  if (unconfirmedIds.length > 0) {
    throw new Error('Sandbox cancellation is not confirmed; the run remains canceling until reconciliation succeeds');
  }

  return { cancelledIds, unconfirmedIds };
}

async function cancelInteractiveRun(input: CancelRunExecutionsInput): Promise<void> {
  const run = await withToolStore((store) => store.getRun(input));

  if (run === null) {
    throw new Error('The cancellation target is unavailable');
  }

  const configuration = toolConfiguration();
  const identity = Schema.decodeUnknownSync(SandboxRunIdentity)({ ...input, mechId: run.mechId });
  const path = sandboxInteractiveCancelPath(identity);

  // Fence late browser actions and process starts before foreground cancellation can retire their machine.
  const isConfirmed = await requestCancellation({ configuration, path });

  if (!isConfirmed) {
    throw new Error(
      'Interactive cancellation is not confirmed; the run remains canceling until reconciliation succeeds',
    );
  }
}

type CancellationRequest = { readonly configuration: RuntimeConfiguration; readonly path: string };

async function requestCancellation({ configuration, path }: CancellationRequest): Promise<boolean> {
  const url = new URL(path, configuration.sandbox.origin);

  const response = await fetch(url, {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${Redacted.value(configuration.sandbox.bearer)}` },
    redirect: 'manual',
    signal: AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS),
  });

  await rejectRedirect(response);
  await response.body?.cancel();

  return response.ok;
}
