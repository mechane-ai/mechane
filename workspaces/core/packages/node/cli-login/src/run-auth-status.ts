import { CredentialSource } from '@mechane/cli-kernel';
import type { CommandResult, Credential, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import { API_KEY_VARIABLE } from '@mechane/commands';
import type { Workspace } from '@mechane/protocol';
import { DateTime, Effect } from 'effect';
import { withCredential } from './with-credential.ts';

/** Where a key came from, as a person reads it. */
const CREDENTIAL_SOURCE_LABEL = {
  [CredentialSource.SavedLogin]: 'the saved login',
  [CredentialSource.Variable]: API_KEY_VARIABLE,
} as const;

/** The calls of `auth status`, its origin, and the key it sends with where that key came from. */
type AuthStatusInput = Pick<RunInput<'auth status'>, 'call' | 'origin'> & Credential;

/**
 * Reports who the CLI's key signs in as, its workspaces and the key's expiry, as the deployment sees them now. A key it
 * refuses, such as a revoked one, reports the command as unauthenticated.
 */
export const runAuthStatus = Effect.fn('runAuthStatus')(function* ({
  call,
  origin,
  credentials,
}: RunInput<'auth status'>): Effect.fn.Return<CommandResult<'auth status'>, RunFailure> {
  const use: (credential: Credential) => Effect.Effect<CommandResult<'auth status'>, ClientFailure> = ({
    token,
    source,
  }) => authStatus({ call, origin, token, source });

  return yield* withCredential({ origin, credentials, use });
});

/** The account the key signs in as, its key and its workspaces, as the deployment reports them now. */
const authStatus = Effect.fn('authStatus')(function* ({
  call,
  origin,
  token,
  source,
}: AuthStatusInput): Effect.fn.Return<CommandResult<'auth status'>, ClientFailure> {
  const { principal, key } = yield* call({ name: 'showPrincipal', input: {}, credential: token });
  const { workspaces } = yield* call({ name: 'listWorkspaces', input: {}, credential: token });

  const workspaceLine: (workspace: Workspace) => string = (workspace) =>
    `workspace ${workspace.name} (${workspace.id}): ${workspace.role}`;

  return {
    lines: [
      `signed in to ${origin.origin} as ${principal.name} with the key ${key.id} from ${CREDENTIAL_SOURCE_LABEL[source]}`,
      `the key expires at ${DateTime.formatIso(key.expiresAt)}`,
      ...workspaces.map(workspaceLine),
    ],
    result: { origin: origin.origin, credentialSource: source, principal, key, workspaces },
  };
});
