import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import { SlackBindingResult, slackEventsPath } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

type BindSlackChannelInput = Pick<RunInput<'slack bind'>, 'call' | 'input' | 'origin'> & WorkspaceAccess;

/** Configures an owner-controlled channel binding and prints its webhook URL. */
export const runSlackBind = Effect.fn('runSlackBind')(function* ({
  call,
  input,
  origin,
  credentials,
}: RunInput<'slack bind'>): Effect.fn.Return<CommandResult<'slack bind'>, RunFailure> {
  const configure: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'slack bind'>, ClientFailure> = (access) =>
    bindSlackChannel({ call, input, origin, ...access });

  return yield* withWorkspace({ call, origin, credentials, use: configure });
});

const bindSlackChannel = Effect.fn('bindSlackChannel')(function* ({
  call,
  input,
  origin,
  token,
  workspaceId: encodedWorkspaceId,
}: BindSlackChannelInput): Effect.fn.Return<CommandResult<'slack bind'>, ClientFailure> {
  const workspaceId = WorkspaceId.make(encodedWorkspaceId);
  const result = yield* call({ name: 'configureSlackBinding', input: { workspaceId, ...input }, credential: token });
  const lines: Array<string> = [result._tag];

  if (SlackBindingResult.guards.Configured(result)) {
    const path = slackEventsPath({ workspaceId, connectionId: input.connectionId });
    const webhook = new URL(path, origin);

    lines.push(webhook.href);
  }

  return { result, lines };
});
