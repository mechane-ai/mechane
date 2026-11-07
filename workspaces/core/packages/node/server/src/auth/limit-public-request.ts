import type { OperationName } from '@mechane/protocol';
import { limitAuthentication } from '@mechane/runtime';
import type { AuthHandlerOptions } from './types.ts';

type PublicRequest = AuthHandlerOptions & { readonly name: OperationName; readonly peerAddress?: string | null };

export async function limitPublicRequest({ name, store, configuration, peerAddress }: PublicRequest): Promise<void> {
  await limitAuthentication({ store, configuration, policy: 'address', subject: peerAddress ?? 'unavailable' });

  if (name === 'startDeviceApproval') {
    await limitAuthentication({ store, configuration, policy: 'deviceStart', subject: peerAddress ?? 'unavailable' });
  }
}
