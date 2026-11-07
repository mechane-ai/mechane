import { KeyMissing, KeyUnrecognized } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { limitAuthentication, resolveAuthentication } from '@mechane/runtime';
import type { AuthCaller } from '@mechane/runtime';
import { READ_METHODS } from '../http/methods.ts';
import { readCookie, requireBrowserOrigin } from './cookies.ts';
import type { AuthRequest } from './types.ts';

type RequestCredential = { readonly kind: 'key' | 'session'; readonly token: string };

function requestCredential(request: Request, origin: string): RequestCredential {
  const authorization = request.headers.get(HttpHeader.Authorization);

  if (authorization !== null) {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    const token = match?.[1];

    if (token === undefined) {
      throw new KeyUnrecognized({});
    }

    return { kind: 'key', token };
  }

  const token = readCookie({ request, origin, name: 'session' });

  if (token === null) {
    throw new KeyMissing({});
  }

  if (!READ_METHODS.has(request.method)) {
    requireBrowserOrigin(request, origin);
  }

  return { kind: 'session', token };
}

export async function authenticateRequest({
  request,
  store,
  configuration,
  peerAddress,
}: AuthRequest): Promise<AuthCaller> {
  await limitAuthentication({ store, configuration, policy: 'address', subject: peerAddress ?? 'unavailable' });

  const credential = requestCredential(request, configuration.origin);
  const caller = await resolveAuthentication({ store, configuration, credential });

  if (caller.principalId !== null) {
    await limitAuthentication({ store, configuration, policy: 'principal', subject: caller.principalId });
  }

  return caller;
}
