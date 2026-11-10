import type { MechRequests } from '@mechane/harness-tools';
import { requestAccess } from './request-access.ts';
import { readTaskContext } from './task-context.ts';
import type { MechRequestsInput } from './types.ts';
import { waitForServiceRequest } from './wait-for-service-request.ts';

/** Host-mediated access requests never expose the integration credential to the model or its sandbox. */
export function mechRequests({ store, settings, signal, recorded }: MechRequestsInput): MechRequests {
  const owner = { store, settings, signal, recorded };
  const request: MechRequests['request'] = async (input) => await requestAccess({ ...owner, ...input });
  const wait: MechRequests['wait'] = async (input) => await waitForServiceRequest({ ...owner, ...input });

  const context: MechRequests['context'] = async ({ threadId }) =>
    await store.atomic({ run: (tables) => readTaskContext({ store: tables, threadId }) });

  return { request, wait, context };
}
