import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { SandboxAction } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Inspection shows current and desired images without waking a suspended workspace. */
export const runSandboxShow = Effect.fn('runSandboxShow')(function* ({
  call,
  origin,
  input,
  credentials,
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
    use: ({ token, workspaceId }) =>
      call({ name: 'manageSandbox', credential: token, input: { ...request, workspaceId, mechId: input.mechId } }),
  });

  return {
    lines: [
      `${result.provider}: ${result.status}`,
      `image: ${Option.getOrElse(result.image, () => 'none')}; desired: ${result.desiredImage}`,
      `operation: ${Option.getOrElse(result.operationId, () => 'none')} (${result.phase})`,
      'retention: files remain until explicit deletion',
    ],
    result,
  };
});
