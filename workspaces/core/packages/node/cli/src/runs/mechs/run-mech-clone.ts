import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect, Option } from 'effect';
import { mechLine } from './mech-line.ts';
import { prepareCreationRequest } from './prepare-creation-request.ts';
import { withWorkspace } from './with-workspace.ts';

/** Copies a definition into a separate identity, printing the request ID before sending so retries reuse it. */
export const runMechClone = Effect.fn('runMechClone')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'mech clone'>): Effect.fn.Return<CommandResult<'mech clone'>, RunFailure> {
  const requestedId = Option.fromUndefinedOr(input.requestId);
  const requestId = prepareCreationRequest({ command: 'mech clone', requestedId });

  const mech = yield* withWorkspace({
    call,
    origin,
    credentials,
    use: ({ token, workspaceId }) =>
      call({ name: 'cloneMech', input: { ...input, requestId, workspaceId }, credential: token }),
  });

  return { lines: [mechLine({ mech })], result: mech };
});
