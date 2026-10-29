import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import type { SlackBinding, SlackBindings } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Lists the workspace channel bindings and their independent listening and reply switches. */
export const runSlackBindings = Effect.fn('runSlackBindings')(function* ({
  call,
  origin,
  credentials,
}: RunInput<'slack bindings'>): Effect.fn.Return<CommandResult<'slack bindings'>, RunFailure> {
  const list: (access: WorkspaceAccess) => Effect.Effect<SlackBindings, ClientFailure> = ({
    token,
    workspaceId: encodedWorkspaceId,
  }) => {
    const workspaceId = WorkspaceId.make(encodedWorkspaceId);

    return call({ name: 'listSlackBindings', input: { workspaceId }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, use: list });

  const format: (binding: SlackBinding) => string = (binding) =>
    `${binding.id} ${binding.channelId} → ${binding.mechId} listening=${binding.isListening} replies=${binding.isReplyEnabled}`;

  const lines = result.bindings.map(format);

  return { result, lines };
});
