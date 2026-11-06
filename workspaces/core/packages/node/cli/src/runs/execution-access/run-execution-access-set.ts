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
  const use: (access: WorkspaceAccess) => Effect.Effect<ExecutionAccessState, RunFailure> = ({ token, workspaceId }) =>
    call({ name: 'configureExecutionAccess', input: { ...input, workspaceId }, credential: token });

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  const line = Option.match(result.access, {
    onSome: () => 'Execution access configured.',
    onNone: () => 'Execution access revoked.',
  });

  return { lines: [line], result };
});
