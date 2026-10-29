import type { WorkerSettings } from '@mechane/bindings';
import type { SlackInstallation } from '@mechane/deployment';
import { SlackMessage } from '@mechane/integrations';
import type { SlackEventCallback } from '@mechane/integrations';
import { InboxText } from '@mechane/protocol';
import type { SlackUserId } from '@mechane/records';
import { Option, Result, Schema } from 'effect';

type ReadHumanSlackMessageInput = {
  readonly settings: WorkerSettings;
  readonly installation: SlackInstallation;
  readonly envelope: SlackEventCallback;
};

type HumanSlackMessageInput = { readonly message: SlackMessage; readonly botUserId: SlackUserId };

/** Accepts bound-team human messages and suppresses bots, self messages, and message changes. */
export function readHumanSlackMessage({
  settings,
  installation,
  envelope,
}: ReadHumanSlackMessageInput): Option.Option<SlackMessage> {
  if (settings.suspendedWorkspaces.includes(installation.workspaceId) || envelope.team_id !== installation.teamId) {
    return Option.none();
  }

  const decoded = Schema.decodeUnknownResult(SlackMessage)(envelope.event);

  if (Result.isFailure(decoded)) {
    return Option.none();
  }

  return humanSlackMessage({ message: decoded.success, botUserId: installation.botUserId });
}

function humanSlackMessage({ message, botUserId }: HumanSlackMessageInput): Option.Option<SlackMessage> {
  if (Option.isSome(message.bot_id) || Option.isSome(message.subtype) || message.user === botUserId) {
    return Option.none();
  }

  const text = Schema.decodeUnknownResult(InboxText)(message.text);

  return Option.liftPredicate(message, () => Result.isSuccess(text));
}
