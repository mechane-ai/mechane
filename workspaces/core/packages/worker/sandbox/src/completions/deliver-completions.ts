import type { SandboxStore } from '@mechane/sandbox-store';
import { SANDBOX_COMPLETION_PATH, SandboxCompletion, SandboxCompletionAccepted } from '@mechane/sandbox-wire';
import type { SandboxCompletionReceipt, SandboxOwner } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Result, Schema } from 'effect';
import { requestRuntimeJson } from '../capacity/request-runtime-json.ts';
import type { SandboxRuntimeSettings } from '../environment.ts';
import { writeCompletionDeliveryFailure } from '../output/write-sandbox-diagnostic.ts';

type DeliveryInput = {
  readonly store: SandboxStore;
  readonly settings: SandboxRuntimeSettings;
  readonly owner: SandboxOwner;
};

type CompletionInput = Pick<DeliveryInput, 'settings'> & { readonly completion: SandboxCompletion };
type PendingCompletionInput = DeliveryInput & { readonly receipt: SandboxCompletionReceipt };

/** The outbox remains pending until the authenticated runtime confirms durable receipt admission. */
export async function deliverCompletions({ store, settings, owner }: DeliveryInput): Promise<void> {
  const now = DateTime.nowUnsafe();
  const pending = store.pendingCompletions({ now });
  const attempts = pending.map((receipt) => deliverPendingCompletion({ store, settings, owner, receipt }));

  await Promise.all(attempts);
}

async function deliverPendingCompletion({ store, settings, owner, receipt }: PendingCompletionInput): Promise<void> {
  const completion = { ...owner, ...receipt };
  const promise = deliverCompletion({ settings, completion });
  const attempted = await capturePromise({ promise });

  if (Result.isSuccess(attempted)) {
    store.completeDelivery(receipt);

    return;
  }

  const now = DateTime.nowUnsafe();

  store.failCompletionDelivery({ ...receipt, now });

  writeCompletionDeliveryFailure(receipt);
}

async function deliverCompletion({ settings, completion }: CompletionInput): Promise<void> {
  const encoded = Schema.encodeSync(SandboxCompletion)(completion);
  const response = await requestRuntimeJson({ settings, path: SANDBOX_COMPLETION_PATH, body: encoded });

  const decoded = Schema.decodeUnknownResult(SandboxCompletionAccepted)(response);

  Result.getOrThrow(decoded);
}
