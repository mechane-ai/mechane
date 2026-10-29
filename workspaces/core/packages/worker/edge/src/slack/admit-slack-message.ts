import { callWorkspace } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import type { SlackInstallation } from '@mechane/deployment';
import type { SlackEventCallback, SlackMessage } from '@mechane/integrations';
import { RequestInvalid } from '@mechane/protocol';
import type { ObjectUnavailable } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { SlackEventAdmission } from '@mechane/rpc';
import { sha256Hex } from '@mechane/utilities';
import { Effect, Option } from 'effect';
import { readHumanSlackMessage } from './read-human-slack-message.ts';
import { receiveSlackMessage } from './receive-slack-message.ts';

type AdmitSlackMessageInput = {
  readonly settings: WorkerSettings;
  readonly installation: SlackInstallation;
  readonly envelope: SlackEventCallback;
};

type PrepareSlackEventInput = AdmitSlackMessageInput & { readonly message: SlackMessage };

/** Durably deduplicates a signed human message before admitting it to the agent inbox. */
export const admitSlackMessage = Effect.fn('admitSlackMessage')(function* (
  input: AdmitSlackMessageInput,
): Effect.fn.Return<HttpStatusCode, ObjectUnavailable | RequestInvalid> {
  const human = readHumanSlackMessage(input);

  if (Option.isNone(human)) {
    return HttpStatusCode.Ok;
  }

  const message = human.value;
  const admission = yield* prepareSlackEvent({ ...input, message });

  if (!SlackEventAdmission.guards.Admitted(admission)) {
    return HttpStatusCode.Ok;
  }

  return yield* receiveSlackMessage({
    settings: input.settings,
    workspaceId: input.installation.workspaceId,
    message,
    admission,
  });
});

const prepareSlackEvent = Effect.fn('prepareSlackEvent')(function* ({
  settings,
  installation,
  envelope,
  message,
}: PrepareSlackEventInput): Effect.fn.Return<SlackEventAdmission, ObjectUnavailable | RequestInvalid> {
  const identity = { teamId: installation.teamId, channelId: message.channel, messageTimestamp: message.ts };
  const threadTimestamp = Option.getOrElse(message.thread_ts, () => message.ts);
  const fingerprintText = JSON.stringify({ ...identity, userId: message.user, text: message.text, threadTimestamp });

  const fingerprint = yield* Effect.tryPromise({
    try: () => sha256Hex({ text: fingerprintText }),
    catch: () => new RequestInvalid({ reason: 'Slack event fingerprint could not be computed' }),
  });

  const event = { ...identity, connectionId: installation.id, eventId: envelope.event_id, fingerprint };

  return yield* callWorkspace({
    settings,
    workspaceId: installation.workspaceId,
    call: ({ workspace }) => workspace.admitSlackEvent(event),
    answer: SlackEventAdmission,
  });
});
