import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { SandboxAction } from '@mechane/protocol';
import type { SandboxReport } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Inspection shows current and desired images without waking a suspended workspace. */
export const runSandboxShow = Effect.fn('runSandboxShow')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'sandbox show'>): Effect.fn.Return<CommandResult<'sandbox show'>, RunFailure> {
  const request = {
    action: SandboxAction.Show,
    operationId: Option.none(),
    droneId: Option.fromNullishOr(input.droneId),
    part: 0,
  };

  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'manageSandbox', credential: token, input: { ...request, workspaceId, mechId: input.mechId } }),
  });

  const lines = sandboxLines(result);

  return { lines, result };
});

function sandboxLines({
  provider,
  status,
  image,
  desiredImage,
  operationId,
  phase,
}: SandboxReport): ReadonlyArray<string> {
  const currentImage = Option.getOrElse(image, () => 'none');
  const operation = Option.getOrElse(operationId, () => 'none');

  return [
    `${provider}: ${status}`,
    `image: ${currentImage}; desired: ${desiredImage}`,
    `operation: ${operation} (${phase})`,
    'retention: files remain until explicit deletion',
  ];
}
