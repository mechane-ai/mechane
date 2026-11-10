import { KeyMissing } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { limitAuthentication, resolveAuthentication } from '@mechane/runtime';
import type { AuthCaller } from '@mechane/runtime';
import { READ_METHODS } from '../http/methods.ts';
import { bearerToken } from './bearer.ts';
import { readCookie, requireBrowserOrigin } from './cookies.ts';
import type { AuthRequest } from './types.ts';

type RequestCredential = { readonly kind: 'key' | 'session'; readonly token: string };

function requestCredential(request: Request, origin: string): RequestCredential {
  const authorization = request.headers.get(HttpHeader.Authorization);

  if (authorization !== null) {
    const token = bearerToken({ authorization });

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

async function authenticatedCaller({ request, store, configuration, peerAddress }: AuthRequest): Promise<AuthCaller> {
  try {
    const credential = requestCredential(request, configuration.origin);

    return await resolveAuthentication({ store, configuration, credential });
  } catch (failure) {
    await limitAuthentication({ store, configuration, policy: 'address', subject: peerAddress ?? 'unavailable' });

    throw failure;
  }
}

export async function authenticateRequest(input: AuthRequest): Promise<AuthCaller> {
  const caller = await authenticatedCaller(input);

  if (caller.principalId !== null) {
    await limitAuthentication({
      store: input.store,
      configuration: input.configuration,
      policy: 'principal',
      subject: caller.principalId,
    });
  }

  return caller;
}
