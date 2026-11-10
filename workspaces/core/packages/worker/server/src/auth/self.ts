import { KeyMissing, KeyUnrecognized } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { verifySelfToken } from '@mechane/runtime';
import type { AuthCaller, RuntimeConfiguration } from '@mechane/runtime';
import { Redacted } from 'effect';
import { bearerToken } from './bearer.ts';

type SelfAuthenticationInput = { readonly request: Request; readonly configuration: RuntimeConfiguration };

export async function authenticateSelfRequest({
  request,
  configuration,
}: SelfAuthenticationInput): Promise<AuthCaller> {
  const authorization = request.headers.get(HttpHeader.Authorization);

  if (authorization === null) {
    throw new KeyMissing({});
  }

  const token = bearerToken({ authorization });

  const scope = await verifySelfToken({ token, serviceKey: Redacted.value(configuration.sandbox.bearer) });

  if (scope === null) {
    throw new KeyUnrecognized({});
  }

  return { authKind: 'self', principalId: null, keyId: null, workspaceId: scope.workspaceId, mechId: scope.mechId };
}
