import type { CredentialSettings, RunFailure } from '@mechane/cli-kernel';
import { WorkspaceSelectionRefused } from '@mechane/cli-kernel';
import { withCredential } from '@mechane/cli-login';
import type { OperationCall } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Array, Effect, Option } from 'effect';
import type { Redacted } from 'effect';

/** A command's work in the caller's workspace: its calls, its origin, where its key comes from, and the work. */
type WithWorkspaceInput<A> = {
  readonly call: OperationCall<'listWorkspaces'>;
  readonly origin: URL;
  readonly credentials: CredentialSettings;
  /** None selects the personal workspace. */
  readonly selectedWorkspaceId: Option.Option<WorkspaceId>;
  readonly use: (access: SelectedWorkspaceAccess) => Effect.Effect<A, RunFailure>;
};

type SelectedWorkspaceAccess = Omit<WorkspaceAccess, 'workspaceId'> & { readonly workspaceId: WorkspaceId };

/** The work in the caller's workspace, and the key that lists the workspace. */
type WorkspaceUseInput<A> = Pick<WithWorkspaceInput<A>, 'call' | 'selectedWorkspaceId' | 'use'> & {
  readonly token: Redacted.Redacted;
};

/** An explicit workspace must be a current membership; omission preserves the personal default. */
export const withWorkspace = Effect.fn('withWorkspace')(function* <A>({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
  use,
}: WithWorkspaceInput<A>): Effect.fn.Return<A, RunFailure> {
  return yield* withCredential({
    origin,
    credentials,
    use: ({ token }) => workspaceUse({ call, token, selectedWorkspaceId, use }),
  });
});

const workspaceUse = Effect.fn('workspaceUse')(function* <A>({
  call,
  token,
  selectedWorkspaceId,
  use,
}: WorkspaceUseInput<A>): Effect.fn.Return<A, RunFailure> {
  const { workspaces } = yield* call({ name: 'listWorkspaces', input: {}, credential: token });

  if (Option.isNone(selectedWorkspaceId)) {
    const personal = Array.headNonEmpty(workspaces);
    const workspaceId = WorkspaceId.make(personal.id);

    return yield* use({ token, workspaceId });
  }

  const workspaceId = selectedWorkspaceId.value;
  const hasMembership = workspaces.some((workspace) => workspace.id === workspaceId);

  if (!hasMembership) {
    return yield* new WorkspaceSelectionRefused({ workspaceId });
  }

  return yield* use({ token, workspaceId });
});
