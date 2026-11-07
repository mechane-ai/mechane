import { HttpHeader } from '@mechane/records';
import { sandboxRuntimeSettings, sandboxServiceKey } from '@mechane/sandbox';
import type { ServiceEnvironment } from './settings.ts';

type AuthenticateInput = { readonly request: Request; readonly environment: ServiceEnvironment };
const BEARER_PREFIX = 'Bearer ';

export async function authenticate({ request, environment }: AuthenticateInput): Promise<boolean> {
  const authorization = request.headers.get(HttpHeader.Authorization);

  if (authorization === null || !authorization.startsWith(BEARER_PREFIX)) {
    return false;
  }

  const settings = sandboxRuntimeSettings({ environment });
  const expected = await sandboxServiceKey({ settings });
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(expected);
  const submittedBytes = encoder.encode(authorization.slice(BEARER_PREFIX.length));

  const key = await crypto.subtle.importKey('raw', expectedBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

  const signature = await crypto.subtle.sign('HMAC', key, expectedBytes);

  return await crypto.subtle.verify('HMAC', key, signature, submittedBytes);
}
