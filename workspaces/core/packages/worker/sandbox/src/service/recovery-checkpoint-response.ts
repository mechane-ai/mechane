import { HttpStatusCode } from '@mechane/records';
import type { SandboxRecoveryCheckpointResult } from '@mechane/sandbox-wire';

type Observation = { readonly result: typeof SandboxRecoveryCheckpointResult.Encoded };

/** Preserves the native repair receipt and exposes whether it is waiting, refused, or terminal. */
export function recoveryCheckpointResponse({ result }: Observation): Response {
  if (result._tag === 'RecoveryCheckpointRefused') {
    return Response.json(result, { status: HttpStatusCode.Conflict });
  }

  if (result._tag === 'Pending') {
    return Response.json(result, { status: HttpStatusCode.Accepted });
  }

  return Response.json(result);
}
