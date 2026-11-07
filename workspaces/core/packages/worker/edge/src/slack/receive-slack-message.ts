import { callMech } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { SlackImageMediaType } from '@mechane/integrations';
import type { SlackMessage } from '@mechane/integrations';
import { InboxText } from '@mechane/protocol';
import type { ObjectUnavailable } from '@mechane/protocol';
import {
  createSlackIntakeNoticeKey,
  HttpStatusCode,
  SlackDestination,
  SlackInboxOrigin,
  SlackOriginKind,
} from '@mechane/records';
import type { WorkspaceId } from '@mechane/records';
import { InboxItemReceipt, SlackEventAdmission, SlackNoticeReceipt } from '@mechane/rpc';
import { Effect, Option, Result, Schema } from 'effect';

type ReceiveSlackMessageInput = {
  readonly settings: WorkerSettings;
  readonly workspaceId: WorkspaceId;
  readonly message: SlackMessage;
  readonly admission: typeof SlackEventAdmission.cases.Admitted.Type | typeof SlackEventAdmission.cases.Refused.Type;
};

type SlackMessageOriginInput = Pick<ReceiveSlackMessageInput, 'message' | 'admission'>;
type ChooseSlackInputTextInput = { readonly text: string; readonly hasImage: boolean };

type ReceiveSlackNoticeInput = Pick<ReceiveSlackMessageInput, 'settings' | 'workspaceId' | 'admission'> & {
  readonly destination: SlackDestination;
  readonly text: string;
};

const isNonEmptyFileField = Schema.is(Schema.NonEmptyString);
const isSlackImageMediaType = Schema.is(SlackImageMediaType);

/** Persists the inbox item and verified origin before acknowledging Slack. */
export const receiveSlackMessage = Effect.fn('receiveSlackMessage')(function* ({
  settings,
  workspaceId,
  message,
  admission,
}: ReceiveSlackMessageInput): Effect.fn.Return<HttpStatusCode, ObjectUnavailable> {
  const facts = slackMessageOrigin({ message, admission });

  if (SlackEventAdmission.guards.Refused(admission)) {
    return yield* receiveSlackNotice({
      settings,
      workspaceId,
      admission,
      destination: facts.destination,
      text: 'This mech is limited to its configured requesters. Ask its workspace owner to add you before sending work.',
    });
  }

  const attachments = Option.fromUndefinedOr(facts.attachments);

  const hasImage = Option.exists(attachments, (files) =>
    files.some((attachment) => Option.exists(attachment.mediaType, isSlackImageMediaType)),
  );

  const text = chooseSlackInputText({ text: message.text, hasImage });
  const decoded = Schema.decodeUnknownResult(InboxText)(text);

  if (Result.isFailure(decoded)) {
    return yield* receiveSlackNotice({
      settings,
      workspaceId,
      admission,
      destination: facts.destination,
      text: 'I received your message, but could not read a request from it. Please add a text caption or a JPEG, PNG, GIF, or WebP image. Keep the text within one message.',
    });
  }

  const origin = Schema.encodeSync(SlackInboxOrigin)(facts);
  const input = { inboxItemId: admission.inboxItemId, text, origin };

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

  if (InboxItemReceipt.guards.Archived(receipt)) {
    return yield* receiveSlackNotice({
      settings,
      workspaceId,
      admission,
      destination: facts.destination,
      text: 'This mech is archived and cannot start new work. Ask its workspace owner to restore it.',
    });
  }

  return HttpStatusCode.Ok;
});

const receiveSlackNotice = Effect.fn('receiveSlackNotice')(function* ({
  settings,
  workspaceId,
  admission,
  destination,
  text,
}: ReceiveSlackNoticeInput): Effect.fn.Return<HttpStatusCode, ObjectUnavailable> {
  const noticeKey = createSlackIntakeNoticeKey({ inboxItemId: admission.inboxItemId });

  const input = { noticeKey, text, destination: Schema.encodeSync(SlackDestination)(destination) };

  const receipt = yield* callMech({
    settings,
    workspaceId,
    mechId: admission.binding.mechId,
    call: ({ mech }) => mech.receiveSlackNotice(input),
    answer: SlackNoticeReceipt,
  });

  if (SlackNoticeReceipt.guards.Received(receipt)) {
    return HttpStatusCode.Ok;
  }

  return HttpStatusCode.Unavailable;
});

function chooseSlackInputText({ text, hasImage }: ChooseSlackInputTextInput): string {
  if (text.length === 0 && hasImage) {
    return '[Image attachment without a text caption]';
  }

  return text;
}

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

  const files = Option.getOrElse(message.files, () => []);

  const attachments = files.map((file) => {
    const downloadUrl = Option.filter(file.url_private_download, isNonEmptyFileField);
    const privateUrl = Option.filter(file.url_private, isNonEmptyFileField);

    return {
      id: file.id,
      name: Option.filter(file.name, isNonEmptyFileField),
      mediaType: Option.filter(file.mimetype, isNonEmptyFileField),
      url: Option.orElse(downloadUrl, () => privateUrl),
    };
  });

  const origin: SlackInboxOrigin = {
    kind: SlackOriginKind.Slack,
    eventId: admission.eventId,
    messageTimestamp: message.ts,
    userId: message.user,
    destination,
  };

  if (attachments.length > 0) {
    return { ...origin, attachments };
  }

  return origin;
}
