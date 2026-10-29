import { callMech } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import type { SlackMessage } from '@mechane/integrations';
import type { ObjectUnavailable } from '@mechane/protocol';
import { HttpStatusCode, SlackInboxOrigin, SlackOriginKind } from '@mechane/records';
import type { WorkspaceId } from '@mechane/records';
import { InboxItemReceipt } from '@mechane/rpc';
import type { SlackEventAdmission } from '@mechane/rpc';
import { Effect, Option, Schema } from 'effect';

type ReceiveSlackMessageInput = {
  readonly settings: WorkerSettings;
  readonly workspaceId: WorkspaceId;
  readonly message: SlackMessage;
  readonly admission: typeof SlackEventAdmission.cases.Admitted.Type;
};

type SlackMessageOriginInput = Pick<ReceiveSlackMessageInput, 'message' | 'admission'>;

/** Persists the inbox item and verified origin before acknowledging Slack. */
export const receiveSlackMessage = Effect.fn('receiveSlackMessage')(function* ({
  settings,
  workspaceId,
  message,
  admission,
}: ReceiveSlackMessageInput): Effect.fn.Return<HttpStatusCode, ObjectUnavailable> {
  const facts = slackMessageOrigin({ message, admission });
  const origin = Schema.encodeSync(SlackInboxOrigin)(facts);
  const input = { inboxItemId: admission.inboxItemId, text: message.text, origin };

  const receipt = yield* callMech({
    settings,
    workspaceId,
    mechId: admission.binding.mechId,
    call: ({ mech }) => mech.receiveSlackInboxItem(input),
    answer: InboxItemReceipt,
  });

  if (InboxItemReceipt.guards.MechMissing(receipt)) {
    return HttpStatusCode.Unavailable;
  }

  return HttpStatusCode.Ok;
});

function slackMessageOrigin({ message, admission }: SlackMessageOriginInput): SlackInboxOrigin {
  const binding = admission.binding;
  const threadTimestamp = Option.getOrElse(message.thread_ts, () => message.ts);

  const destination = {
    bindingId: binding.id,
    connectionId: binding.connectionId,
    teamId: binding.teamId,
    channelId: binding.channelId,
    threadTimestamp: Option.some(threadTimestamp),
  };

  return {
    kind: SlackOriginKind.Slack,
    eventId: admission.eventId,
    messageTimestamp: message.ts,
    userId: message.user,
    destination,
  };
}
