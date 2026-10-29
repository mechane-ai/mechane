import type { CredentialSettings, RunFailure } from '@mechane/cli-kernel';
import { withCredential } from '@mechane/cli-login';
import type { OperationCall } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import { Array, Effect } from 'effect';
import type { Redacted } from 'effect';

/** A command's work in the caller's workspace: its calls, its origin, where its key comes from, and the work. */
type WithWorkspaceInput<A> = {
  readonly call: OperationCall<'listWorkspaces'>;
  readonly origin: URL;
  readonly credentials: CredentialSettings;
  readonly use: (access: WorkspaceAccess) => Effect.Effect<A, RunFailure>;
};

/** The work in the caller's workspace, and the key that lists the workspace. */
type WorkspaceUseInput<A> = Pick<WithWorkspaceInput<A>, 'call' | 'use'> & { readonly token: Redacted.Redacted };

/**
 * Runs `use` with the key a command sends and the caller's one workspace, the personal workspace its sign-up made,
 * where every mech command acts.
 */
export const withWorkspace = Effect.fn('withWorkspace')(function* <A>({
  call,
  origin,
  credentials,
  use,
}: WithWorkspaceInput<A>): Effect.fn.Return<A, RunFailure> {
  return yield* withCredential({ origin, credentials, use: ({ token }) => workspaceUse({ call, token, use }) });
});

/** Runs `use` in the caller's first workspace, which the deployment lists first. */
const workspaceUse = Effect.fn('workspaceUse')(function* <A>({
  call,
  token,
  use,
}: WorkspaceUseInput<A>): Effect.fn.Return<A, RunFailure> {
  const { workspaces } = yield* call({ name: 'listWorkspaces', input: {}, credential: token });

  return yield* use({ token, workspaceId: Array.headNonEmpty(workspaces).id });
});
