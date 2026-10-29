import { RemoteToolsOutcome } from '@mechane/protocol';
import { capturePromise } from '@mechane/utilities';
import { Result } from 'effect';

type ReadRemotePortOutcomeInput = { readonly promise: Promise<RemoteToolsOutcome> };

/** Sanitizes rejected host promises before they become model-visible tool output. */
export async function readRemotePortOutcome({ promise }: ReadRemotePortOutcomeInput): Promise<RemoteToolsOutcome> {
  const result = await capturePromise({ promise });

  if (Result.isFailure(result)) {
    return RemoteToolsOutcome.cases.Failed.make({ reason: 'The remote tool operation could not be completed' });
  }

  return result.success;
}
