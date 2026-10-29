import { capturePromise } from '@mechane/utilities';
import { Result } from 'effect';
import type { RemoteSession } from './types.ts';

type CloseRemoteSessionInput = Pick<RemoteSession, 'client'>;

/** Reports whether cleanup completed so a failed close cannot erase the primary outcome. */
export async function closeRemoteSession({ client }: CloseRemoteSessionInput): Promise<boolean> {
  const promise = client.close();
  const result = await capturePromise({ promise });

  return Result.isSuccess(result);
}
