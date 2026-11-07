import { fetchSlackFile } from '@chat-adapter/slack/api';
import { HttpHeader, MediaType } from '@mechane/records';
import type { FileUIPart, UIMessage } from 'ai';
import { Redacted } from 'effect';
import { FatalError } from 'workflow';
import type { InputAttachment } from '../domain.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { readBoundedBytes } from './read-bounded-bytes.ts';
import { boundedSlackFetch } from './reconcile-delivery.ts';

const IMAGE_MAX_BYTES = 4_194_304;
const INPUT_IMAGE_MAX_BYTES = 8_388_608;
const INPUT_IMAGES_MAX_ITEMS = 3;
const IMAGE_MEDIA_TYPES: ReadonlySet<string> = new Set([MediaType.Png, MediaType.Jpeg, MediaType.Webp, MediaType.Gif]);
const IMAGE_SIGNATURE_BYTES = 12;
const PNG_SIGNATURE_HEX = '89504e470d0a1a0a';
const JPEG_SIGNATURE_HEX = 'ffd8ff';

const UNSUPPORTED_FILES_MESSAGE =
  'I could not read the attached files. Please add a description or attach a PNG, JPEG, WebP, or GIF image.';

type HydrateInput = { readonly runId: string };

export async function hydrateSlackInput({ runId }: HydrateInput): Promise<UIMessage> {
  return await withRuntimeStore(async (store) => {
    const run = await store.getRun({ runId });
    const input = await store.getRunInput({ runId });

    if (run === null || input === null) {
      throw new FatalError('The accepted input is unavailable');
    }

    if (run.origin.kind !== 'slack' || input.attachments.length === 0) {
      return input.inputMessage;
    }

    const installation = await store.getSlackInstallation({
      installationId: run.origin.installationId,
      workspaceId: run.workspaceId,
    });

    if (installation === null) {
      throw new FatalError('The Slack installation is unavailable');
    }

    const token = await store.getCredential({
      workspaceId: run.workspaceId,
      reference: installation.botTokenReference,
    });

    if (token === null) {
      throw new FatalError('The Slack file credential is unavailable');
    }

    const parts: UIMessage['parts'] = [...input.inputMessage.parts];
    const notes: Array<string> = [];
    const budget = { bytes: 0, images: 0 };

    for (const attachment of input.attachments) {
      const prepared = await prepareSlackImage({
        attachment,
        token: Redacted.value(token),
        remainingImages: INPUT_IMAGES_MAX_ITEMS - budget.images,
        remainingBytes: INPUT_IMAGE_MAX_BYTES - budget.bytes,
      });

      if (prepared.kind === 'image') {
        budget.bytes += prepared.bytes;
        budget.images += 1;

        parts.push(prepared.part);
      } else {
        notes.push(prepared.note);
      }
    }

    if (budget.images === 0 && run.inputText.trim().length === 0) {
      const finished = await store.finishRun({
        runId,
        status: 'failed',
        reply: null,
        error: UNSUPPORTED_FILES_MESSAGE,
      });

      throw new FatalError(finished.error ?? 'The run is no longer active.');
    }

    if (notes.length > 0) {
      parts.push({ type: 'text', text: `Attachment notes:\n${notes.join('\n')}` });
    }

    return { ...input.inputMessage, parts };
  });
}

type SlackImage = InputAttachment & { readonly mediaType: string; readonly url: string };

type PreparedImage =
  | { readonly kind: 'image'; readonly bytes: number; readonly part: FileUIPart }
  | { readonly kind: 'omitted'; readonly note: string };

type PrepareImageInput = {
  readonly attachment: InputAttachment;
  readonly token: string;
  readonly remainingImages: number;
  readonly remainingBytes: number;
};

async function prepareSlackImage({
  attachment,
  token,
  remainingImages,
  remainingBytes,
}: PrepareImageInput): Promise<PreparedImage> {
  const image = slackImage(attachment);

  if (image === null) {
    return { kind: 'omitted', note: `${attachment.name}: this attachment type could not be read.` };
  }

  if (remainingImages <= 0 || remainingBytes <= 0) {
    return { kind: 'omitted', note: `${attachment.name}: omitted because the message image limit was reached.` };
  }

  try {
    const bytes = await readSlackImage({
      attachment: image,
      token,
      maximumBytes: Math.min(IMAGE_MAX_BYTES, remainingBytes),
    });

    return {
      kind: 'image',
      bytes: bytes.byteLength,
      part: {
        type: 'file',
        mediaType: image.mediaType,
        filename: attachment.name,
        url: `data:${image.mediaType};base64,${Buffer.from(bytes).toString('base64')}`,
      },
    };
  } catch {
    return { kind: 'omitted', note: `${attachment.name}: the image was unavailable or exceeded the message limit.` };
  }
}

function slackImage(attachment: InputAttachment): SlackImage | null {
  if (attachment.mediaType === null || attachment.url === null) {
    return null;
  }

  if (!IMAGE_MEDIA_TYPES.has(attachment.mediaType)) {
    return null;
  }

  const parsed = URL.parse(attachment.url);

  if (parsed === null) {
    return null;
  }

  const isSlackFileOrigin = parsed.protocol === 'https:' && parsed.hostname === 'files.slack.com' && parsed.port === '';
  const hasCredentials = parsed.username !== '' || parsed.password !== '';

  if (!isSlackFileOrigin || hasCredentials) {
    return null;
  }

  return { ...attachment, mediaType: attachment.mediaType, url: attachment.url };
}

type ReadImageInput = { readonly attachment: SlackImage; readonly token: string; readonly maximumBytes: number };

async function readSlackImage({ attachment, token, maximumBytes }: ReadImageInput): Promise<Uint8Array> {
  const response = await fetchSlackFile({ token, url: attachment.url, fetch: boundedSlackFetch });
  const mediaType = response.headers.get(HttpHeader.ContentType)?.split(';')[0]?.trim().toLowerCase();

  if (!response.ok || mediaType !== attachment.mediaType) {
    throw new Error('Slack image response was not the expected media type');
  }

  if (response.body === null) {
    throw new Error('Slack image response has no body');
  }

  const bytes = await readBoundedBytes({ body: response.body, maximumBytes });

  if (!hasImageSignature(bytes, attachment.mediaType)) {
    throw new Error('Slack image content does not match its media type');
  }

  return bytes;
}

function hasImageSignature(bytes: Uint8Array, mediaType: string): boolean {
  const prefix = Buffer.from(bytes.subarray(0, IMAGE_SIGNATURE_BYTES));

  switch (mediaType) {
    case MediaType.Png:
      return prefix.toString('hex').startsWith(PNG_SIGNATURE_HEX);
    case MediaType.Jpeg:
      return prefix.toString('hex').startsWith(JPEG_SIGNATURE_HEX);
    case MediaType.Gif:
      return /^GIF8[79]a/u.test(prefix.toString('ascii'));
    case MediaType.Webp:
      return /^RIFF[\s\S]{4}WEBP/u.test(prefix.toString('latin1'));
    default:
      return false;
  }
}
