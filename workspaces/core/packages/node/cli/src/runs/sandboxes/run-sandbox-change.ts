import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { SandboxAction } from '@mechane/protocol';
import { SandboxOperationId } from '@mechane/records';
import { Effect, Option } from 'effect';
import { randomUUID } from 'node:crypto';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { maintainSandbox } from './maintain-sandbox.ts';

type ChangeCommand = 'sandbox upgrade' | 'sandbox delete' | 'sandbox cancel';
type RunSandboxChangeInput<N extends ChangeCommand> = RunInput<N> & { readonly action: SandboxAction };

/** The CLI creates a retry id once and prints it before starting maintenance. */
export const runSandboxChange = Effect.fn('runSandboxChange')(function* <N extends ChangeCommand>({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
  action,
}: RunSandboxChangeInput<N>): Effect.fn.Return<CommandResult<N>, RunFailure> {
  const fallback = SandboxOperationId.make(randomUUID());
  const specified = Option.fromNullishOr(input.operationId);
  const operationId = Option.getOrElse(specified, () => fallback);
  const droneId = Option.fromNullishOr(input.droneId);
  const request = { action, operationId: Option.some(operationId), droneId, part: 0 };

  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) => maintainSandbox({ call, token, workspaceId, mechId: input.mechId, request }),
  });

  return { lines: [`${result.status} ${result.phase} ${Option.getOrElse(result.image, () => '')}`], result };
});
