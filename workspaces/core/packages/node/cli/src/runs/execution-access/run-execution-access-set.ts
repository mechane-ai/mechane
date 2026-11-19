import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import type { ExecutionAccessState } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Replaces the current owner's grant for future commands. */
export const runExecutionAccessSet = Effect.fn('runExecutionAccessSet')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'execution-access set'>): Effect.fn.Return<CommandResult<'execution-access set'>, RunFailure> {
  const granted = Option.some(input.access);

  const use: (access: WorkspaceAccess) => Effect.Effect<ExecutionAccessState, RunFailure> = ({ token, workspaceId }) =>
    call({
      name: 'configureManagedCommandAccess',
      input: { ...input, workspaceId, access: granted },
      credential: token,
    });

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  return { lines: ['Execution access configured.'], result };
});

export const runExecutionAccessRevoke = Effect.fn('runExecutionAccessRevoke')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'execution-access revoke'>): Effect.fn.Return<CommandResult<'execution-access revoke'>, RunFailure> {
  const revoked = Option.none();

  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({
        name: 'configureManagedCommandAccess',
        input: { ...input, workspaceId, access: revoked },
        credential: token,
      }),
  });

  return { lines: ['Execution access revoked.'], result };
});
