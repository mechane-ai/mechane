import { HttpHeader, HttpMethod } from '@mechane/records';
import { sandboxExecutionCancelPath, SandboxExecutionIdentity } from '@mechane/sandbox-wire';
import { Redacted, Schema } from 'effect';
import { loadRuntimeConfiguration } from '../config.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { TOOL_REQUEST_TIMEOUT_MS } from './constants.ts';

type CancelRunExecutionsInput = { readonly runId: string; readonly workspaceId: string };

export type ExecutionCancellation = {
  readonly cancelledIds: ReadonlyArray<string>;
  readonly unconfirmedIds: ReadonlyArray<string>;
};

const FINAL_RECEIPT_STATES: ReadonlySet<string> = new Set(['completed', 'failed']);

export async function cancelRunExecutions(input: CancelRunExecutionsInput): Promise<ExecutionCancellation> {
  const receipts = await withRuntimeStore((store) => store.listRunExecutions(input));
  const configuration = loadRuntimeConfiguration();
  const cancelledIds: Array<string> = [];
  const unconfirmedIds: Array<string> = [];

  const active = receipts.filter((receipt) => receipt.kind === 'sandbox' && !FINAL_RECEIPT_STATES.has(receipt.status));

  for (const receipt of active) {
    const identity = Schema.decodeUnknownSync(SandboxExecutionIdentity)({
      workspaceId: input.workspaceId,
      mechId: receipt.mechId,
      executionId: receipt.id,
    });

    const url = new URL(sandboxExecutionCancelPath(identity), configuration.sandbox.origin);

    try {
      const response = await fetch(url, {
        method: HttpMethod.Post,
        headers: { [HttpHeader.Authorization]: `Bearer ${Redacted.value(configuration.sandbox.bearer)}` },
        redirect: 'error',
        signal: AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS),
      });

      await response.body?.cancel();

      if (response.ok) {
        cancelledIds.push(receipt.id);
      } else {
        unconfirmedIds.push(receipt.id);
      }
    } catch {
      unconfirmedIds.push(receipt.id);
    }
  }

  return { cancelledIds, unconfirmedIds };
}
