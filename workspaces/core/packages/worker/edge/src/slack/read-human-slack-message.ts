import { callWorkspacePolicy } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { SlackMessage, SlackMessageSubtype } from '@mechane/integrations';
import type { SlackEventCallback } from '@mechane/integrations';
import type { ObjectUnavailable, SlackInstallation } from '@mechane/protocol';
import type { SlackUserId } from '@mechane/records';
import { Effect, Option, Result, Schema } from 'effect';

type ReadHumanSlackMessageInput = {
  readonly settings: WorkerSettings;
  readonly installation: SlackInstallation;
  readonly envelope: SlackEventCallback;
};

type HumanSlackMessageInput = { readonly message: SlackMessage; readonly botUserId: SlackUserId };

/** Accepts bound-team human messages and suppresses bots, self messages, and message changes. */
export const readHumanSlackMessage = Effect.fn('readHumanSlackMessage')(function* ({
  settings,
  installation,
  envelope,
}: ReadHumanSlackMessageInput): Effect.fn.Return<Option.Option<SlackMessage>, ObjectUnavailable> {
  if (envelope.team_id !== installation.teamId) {
    return Option.none();
  }

  const policy = yield* callWorkspacePolicy({ settings, workspaceId: installation.workspaceId });

  if (policy.isSuspended) {
    return Option.none();
  }

  const decoded = Schema.decodeUnknownResult(SlackMessage)(envelope.event);

  if (Result.isFailure(decoded)) {
    return Option.none();
  }

  return humanSlackMessage({ message: decoded.success, botUserId: installation.botUserId });
});

function humanSlackMessage({ message, botUserId }: HumanSlackMessageInput): Option.Option<SlackMessage> {
  if (Option.isSome(message.bot_id) || message.user === botUserId) {
    return Option.none();
  }

  if (Option.isSome(message.subtype) && message.subtype.value !== SlackMessageSubtype.FileShare) {
    return Option.none();
  }

  return Option.some(message);
}
