import type { ImageContent, UserMessage } from '@earendil-works/pi-ai';
import type { SubmissionDraft } from '@earendil-works/pi-durable';
import { Delivery } from '@mechane/protocol';
import { renamedWireStruct } from '@mechane/records';
import { DateTime, Schema } from 'effect';
import { INBOX_ITEM_ENTRY_KIND, INBOX_SUBMISSION_MAX_BYTES } from './constants.ts';
import type { SubmissionDraftInput } from './types.ts';

type BoundedSubmissionInput = SubmissionDraftInput & { readonly imageCount: number };
type MeasureSubmissionInput = { readonly draft: SubmissionDraft };

const PI_IMAGE_CONTENT_TYPE = 'image';
const isSubmissionByteLength = Schema.isLessThanOrEqualTo(INBOX_SUBMISSION_MAX_BYTES);
const SubmissionByteLength = Schema.Int.check(isSubmissionByteLength);

const PiImageContent = renamedWireStruct({
  fields: {
    type: Schema.Literal(PI_IMAGE_CONTENT_TYPE),
    base64: Schema.NonEmptyString,
    mediaType: Schema.NonEmptyString,
  },
  renames: { base64: 'data', mediaType: 'mimeType' },
});

/** Bounds the complete serialized image submission before pi stores it as one SQLite entry or inbox document. */
export async function createInboxSubmission({ inboxItem }: SubmissionDraftInput): Promise<SubmissionDraft> {
  if (inboxItem.images.length === 0) {
    return createSubmissionDraft({ inboxItem, imageCount: 0 });
  }

  const textDraft = createSubmissionDraft({ inboxItem, imageCount: 0 });
  const textBytes = measureSubmissionBytes({ draft: textDraft });

  // Reject an oversized caption or its attachment notes instead of silently truncating the user's request.
  await Schema.decodeUnknownPromise(SubmissionByteLength)(textBytes);

  const imageCounts = Array.from({ length: inboxItem.images.length }, (_, index) => inboxItem.images.length - index);

  for (const imageCount of imageCounts) {
    const draft = createSubmissionDraft({ inboxItem, imageCount });
    const bytes = measureSubmissionBytes({ draft });

    if (bytes <= INBOX_SUBMISSION_MAX_BYTES) {
      return draft;
    }
  }

  return textDraft;
}

function measureSubmissionBytes({ draft }: MeasureSubmissionInput): number {
  const serialized = JSON.stringify(draft);
  const encoder = new TextEncoder();

  return encoder.encode(serialized).byteLength;
}

/** A next-pause input steers the active turn; idle and interrupted inputs wait for their own turn. */
function createSubmissionDraft({ inboxItem, imageCount }: BoundedSubmissionInput): SubmissionDraft {
  const { id: requestId, receivedAt } = inboxItem;
  const entry = { kind: INBOX_ITEM_ENTRY_KIND };
  const content = createSubmissionContent({ inboxItem, imageCount });

  switch (inboxItem.delivery) {
    case Delivery.WhenIdle:
    case Delivery.Interrupt:
      return { type: 'input', requestId, content, whenBusy: 'followUp', entry };
    case Delivery.NextPause:
      return { type: 'input', requestId, content, whenBusy: 'steer', entry };
    case Delivery.Silent:
      // A write that carries no model message would never reach the model.
      return {
        type: 'write',
        requestId,
        entry: { ...entry, model: [{ role: 'user', content, timestamp: DateTime.toEpochMillis(receivedAt) }] },
      };
  }
}

function createSubmissionContent({ inboxItem, imageCount }: BoundedSubmissionInput): UserMessage['content'] {
  const text = createSubmissionText({ inboxItem, imageCount });

  if (imageCount === 0) {
    return text;
  }

  const encodeImage = Schema.encodeSync(PiImageContent);
  const images = inboxItem.images.slice(0, imageCount);

  const imageContent: Array<ImageContent> = images.map((image) =>
    encodeImage({ type: PI_IMAGE_CONTENT_TYPE, ...image }),
  );

  return [{ type: 'text', text }, ...imageContent];
}

function createSubmissionText({ inboxItem, imageCount }: BoundedSubmissionInput): string {
  if (imageCount === inboxItem.images.length) {
    return inboxItem.text;
  }

  const omittedCount = inboxItem.images.length - imageCount;
  const note = `${imageCount} downloaded images were included; ${omittedCount} were omitted because the complete request exceeds the image input limit. The omitted image contents were not delivered to the model. Ask for smaller images or a text description when needed.`;

  return `${inboxItem.text}\n\n[Image input limit]\n${note}`;
}
