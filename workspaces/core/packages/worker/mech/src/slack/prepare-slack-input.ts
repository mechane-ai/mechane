import type { DeliverInput, InboxImage } from '@mechane/harness';
import { readSlackImage, SLACK_IMAGE_MAX_COUNT, SlackImageMediaType, SlackImageResult } from '@mechane/integrations';
import { InboxItemId } from '@mechane/records';
import type { SlackAttachment } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import type { Redacted } from 'effect';
import type { OpenedMech } from '../types.ts';
import { resolveSlackClient } from './resolve-slack-client.ts';

type PrepareInput = { readonly mech: OpenedMech; readonly delivery: DeliverInput };
type ReadSlackAttachmentInput = { readonly attachment: SlackAttachment; readonly token: Redacted.Redacted };

type SlackAttachmentContent = {
  /** Absent when the file type is unsupported or its download failed. */
  readonly image: Option.Option<InboxImage>;
  readonly note: string;
};

const isSlackImageMediaType = Schema.is(SlackImageMediaType);
const SLACK_ATTACHMENT_LABEL_MAX_CHARS = 256;

/** Resolves only signed, bounded Slack attachments before the inbox item's idempotent harness submission. */
export async function prepareSlackInput({ mech, delivery }: PrepareInput): Promise<DeliverInput> {
  const inboxItemId = InboxItemId.make(delivery.inboxItem.id);

  const state = await mech.store.atomic({
    run: (tables) => ({ origin: tables.slackInboxOrigin({ inboxItemId }), current: tables.mech() }),
  });

  const attachments = Option.flatMap(state.origin, (origin) => Option.fromUndefinedOr(origin.attachments));

  if (Option.isNone(state.origin) || Option.isNone(state.current)) {
    return delivery;
  }

  if (Option.isNone(attachments) || attachments.value.length === 0) {
    return delivery;
  }

  const supportsImages = mech.settings.modelOffers.some(
    (offer) => offer.id === delivery.agent.modelId && offer.supportsImages === true,
  );

  if (!supportsImages) {
    return withAttachments({
      delivery,
      images: [],
      notes: [
        'Attachments were not read: the selected model does not accept images. Ask the sender for a text description if the caption is insufficient.',
      ],
    });
  }

  const client = await resolveSlackClient({
    settings: mech.settings,
    mech: state.current.value,
    destination: state.origin.value.destination,
  });

  if (Result.isFailure(client) || Option.isNone(client.success)) {
    return withAttachments({
      delivery,
      images: [],
      notes: [
        'Attachments were not read: the Slack file credential is unavailable. Tell the sender when this prevents completing their request.',
      ],
    });
  }

  const considered = attachments.value.slice(0, SLACK_IMAGE_MAX_COUNT);
  const token = client.success.value.botToken;
  const downloads = considered.map((attachment) => readSlackAttachment({ attachment, token }));
  const contents = await Promise.all(downloads);

  const images = contents.flatMap((content) => Option.toArray(content.image));
  const notes = contents.map((content) => content.note);

  if (attachments.value.length > SLACK_IMAGE_MAX_COUNT) {
    notes.push(
      `Only the first ${SLACK_IMAGE_MAX_COUNT} attachments were considered; remaining attachments were not read.`,
    );
  }

  return withAttachments({ delivery, images, notes });
}

async function readSlackAttachment({ attachment, token }: ReadSlackAttachmentInput): Promise<SlackAttachmentContent> {
  const name = Option.getOrElse(attachment.name, () => attachment.id);
  const boundedName = name.slice(0, SLACK_ATTACHMENT_LABEL_MAX_CHARS).toWellFormed();
  const label = JSON.stringify(boundedName);
  const isSupported = Option.exists(attachment.mediaType, isSlackImageMediaType);

  if (!isSupported) {
    return { image: Option.none(), note: `${label}: unsupported attachment type; its content was not read.` };
  }

  const result = await readSlackImage({ attachment, token });

  if (SlackImageResult.guards.Image(result)) {
    const image = Option.some({ base64: result.base64, mediaType: result.mediaType });

    return { image, note: `${label}: image downloaded.` };
  }

  return { image: Option.none(), note: `${label}: ${result.reason}. Its content was not read.` };
}

type WithAttachmentsInput = {
  readonly delivery: DeliverInput;
  readonly images: ReadonlyArray<InboxImage>;
  readonly notes: ReadonlyArray<string>;
};

function withAttachments({ delivery, images, notes }: WithAttachmentsInput): DeliverInput {
  const text = `${delivery.inboxItem.text}\n\n[Slack attachment delivery]\n${notes.join('\n')}`;

  return { ...delivery, inboxItem: { ...delivery.inboxItem, text, images } };
}
