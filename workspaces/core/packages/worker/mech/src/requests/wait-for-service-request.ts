import type { MechRequests, RequestWaitInput } from '@mechane/harness-tools';
import { readServiceRequest } from '@mechane/integrations';
import { HttpMethod } from '@mechane/records';
import { Option, Result } from 'effect';
import { loadOpenWorkService } from './request-service.ts';
import type { MechRequestsInput } from './types.ts';
import { registerRequestWait } from './wait-for-request.ts';

type WaitForServiceRequestInput = MechRequestsInput & RequestWaitInput;

/** An external ID must exist in this service identity before a CLI-created request can hold work waiting. */
export async function waitForServiceRequest({
  store,
  settings,
  signal,
  recorded,
  taskId,
  threadId,
  kind,
  requestId,
}: WaitForServiceRequestInput): ReturnType<MechRequests['wait']> {
  const loaded = await loadOpenWorkService({ store, settings, threadId });

  if (Result.isFailure(loaded)) {
    return Result.fail(loaded.failure);
  }

  const emptyBody = Option.none<string>();

  const result = await readServiceRequest({
    ...loaded.success,
    kind,
    requestId,
    method: HttpMethod.Get,
    body: emptyBody,
  });

  if (Result.isFailure(result)) {
    return Result.fail(result.failure);
  }

  return await registerRequestWait({
    store,
    settings,
    signal,
    recorded,
    taskId,
    threadId,
    kind,
    requestId,
    serviceIdentity: loaded.success.identity,
    status: result.success,
  });
}
