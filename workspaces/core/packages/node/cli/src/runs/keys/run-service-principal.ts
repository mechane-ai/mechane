import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { prepareKeyFile } from '@mechane/cli-login';
import type { WorkspaceServicePrincipal } from '@mechane/protocol';
import { DateTime, Effect, Option } from 'effect';
import { withWorkspace } from '../with-workspace.ts';

type ServiceLinesInput = { readonly principal: WorkspaceServicePrincipal };

function serviceLines({ principal }: ServiceLinesInput): ReadonlyArray<string> {
  const lines = [`${principal.subject} (${principal.principalId})`];

  if (Option.isSome(principal.activeKey)) {
    const { keyId, expiresAt } = principal.activeKey.value;
    const expiration = DateTime.formatIso(expiresAt);

    lines.push(`key ${keyId} expires at ${expiration}`);
  } else {
    lines.push('No active key.');
  }

  return lines;
}

/** Read service metadata; bearer tokens are only returned by rotation. */
export const runServicePrincipalShow = Effect.fn('runServicePrincipalShow')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
  input,
}: RunInput<'service-principal show'>): Effect.fn.Return<CommandResult<'service-principal show'>, RunFailure> {
  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({
        name: 'showWorkspaceServicePrincipal',
        credential: token,
        input: { workspaceId, subject: input.subject },
      }),
  });

  return { lines: serviceLines({ principal: result }), result };
});

/** Save the new bearer privately before reporting its public metadata. */
export const runServicePrincipalRotate = Effect.fn('runServicePrincipalRotate')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
  input,
}: RunInput<'service-principal rotate'>): Effect.fn.Return<CommandResult<'service-principal rotate'>, RunFailure> {
  const { subject, keyFile } = input;
  const destination = yield* prepareKeyFile({ path: keyFile });

  const issued = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'rotateWorkspaceServiceKey', credential: token, input: { workspaceId, subject } }),
  });

  yield* destination.write({ token: issued.token });

  const { keyId, expiresAt, principalId } = issued;
  const activeKey = Option.some({ keyId, expiresAt });
  const result = { subject, principalId, activeKey };
  const metadata = serviceLines({ principal: result });

  return { lines: [...metadata, `Wrote its token to ${keyFile}.`], result };
});

/** Revoke exactly the addressed key, so a delayed revocation cannot revoke its replacement. */
export const runServicePrincipalRevoke = Effect.fn('runServicePrincipalRevoke')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
  input,
}: RunInput<'service-principal revoke'>): Effect.fn.Return<CommandResult<'service-principal revoke'>, RunFailure> {
  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'revokeWorkspaceServiceKey', credential: token, input: { ...input, workspaceId } }),
  });

  return { lines: [`Revoked service key ${result.keyId}.`], result };
});
