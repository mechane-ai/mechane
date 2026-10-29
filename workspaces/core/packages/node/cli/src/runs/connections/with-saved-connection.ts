import type { CredentialSettings, RunFailure } from '@mechane/cli-kernel';
import type { OperationCall } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import type { RemoteConnection } from '@mechane/protocol';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

type WithSavedConnectionInput = {
  readonly call: OperationCall<'listWorkspaces'>;
  readonly origin: URL;
  readonly credentials: CredentialSettings;
  readonly use: (access: WorkspaceAccess) => Effect.Effect<RemoteConnection, RunFailure>;
};

type SavedConnectionResult = { readonly lines: ReadonlyArray<string>; readonly result: RemoteConnection };

/** Connection saves use the caller's workspace and print the resulting owner-approved policy. */
export const withSavedConnection = Effect.fn('withSavedConnection')(function* ({
  call,
  origin,
  credentials,
  use,
}: WithSavedConnectionInput): Effect.fn.Return<SavedConnectionResult, RunFailure> {
  const result = yield* withWorkspace({ call, origin, credentials, use });

  return { lines: [`${result.id} ${result.name} (${result.policy})`], result };
});
