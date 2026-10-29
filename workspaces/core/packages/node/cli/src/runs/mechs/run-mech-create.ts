import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect, Option } from 'effect';
import { mechLine } from './mech-line.ts';
import { prepareCreationRequest } from './prepare-creation-request.ts';
import { withWorkspace } from './with-workspace.ts';

/** Creates a mech in the caller's workspace, with the deployment's first offer unless the input names a model. */
export const runMechCreate = Effect.fn('runMechCreate')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'mech create'>): Effect.fn.Return<CommandResult<'mech create'>, RunFailure> {
  const requestedId = Option.fromUndefinedOr(input.requestId);
  const requestId = prepareCreationRequest({ command: 'mech create', requestedId });

  const mech = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'createMech', input: { ...input, requestId, workspaceId }, credential: token }),
  });

  return { lines: [mechLine({ mech })], result: mech };
});
