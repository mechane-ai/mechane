import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import type { ExecutionAccessState } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Shows public configuration and references, never resolved credentials. */
export const runExecutionAccessShow = Effect.fn('runExecutionAccessShow')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'execution-access show'>): Effect.fn.Return<CommandResult<'execution-access show'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<ExecutionAccessState, RunFailure> = ({ token, workspaceId }) =>
    call({ name: 'showExecutionAccess', input: { ...input, workspaceId }, credential: token });

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  return Option.match(result.access, {
    onSome: () => ({ lines: ['Execution access configured.'], result }),
    onNone: () => ({ lines: ['No execution access.'], result }),
  });
});
