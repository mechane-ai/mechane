import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import type { SlackDeliveries, SlackDelivery } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Runs due outbox work through the active agent and its existing alarm. */
export const runSlackDeliveries = Effect.fn('runSlackDeliveries')(function* ({
  call,
  input,
  origin,
  credentials,
}: RunInput<'slack deliveries'>): Effect.fn.Return<CommandResult<'slack deliveries'>, RunFailure> {
  const list: (access: WorkspaceAccess) => Effect.Effect<SlackDeliveries, ClientFailure> = ({
    token,
    workspaceId: encodedWorkspaceId,
  }) => {
    const workspaceId = WorkspaceId.make(encodedWorkspaceId);

    return call({ name: 'listSlackDeliveries', input: { workspaceId, mechId: input.mechId }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, use: list });

  const format: (delivery: SlackDelivery) => string = (delivery) => {
    const fields: Array<string> = [delivery.id, delivery.status];

    if (Option.isSome(delivery.lastError)) {
      fields.push(delivery.lastError.value);
    }

    return fields.join(' ');
  };

  const lines = result.deliveries.map(format);

  return { result, lines };
});
