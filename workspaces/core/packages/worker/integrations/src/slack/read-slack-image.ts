import { OriginProtocol } from '@mechane/deployment';
import { HttpHeader, HttpMethod } from '@mechane/records';
import type { SlackAttachment } from '@mechane/records';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import type { Redacted } from 'effect';
import { Base64 } from 'effect/encoding';
import { boundRemoteResponse } from '../http/bound-remote-response.ts';
import { SLACK_IMAGE_MAX_BYTES, SLACK_PRIVATE_FILE_HOST, SLACK_REQUEST_TIMEOUT } from './constants.ts';
import { SlackImageMediaType, SlackImageResult } from './schemas.ts';
import { slackAuthorization } from './slack-authorization.ts';

const isPrivateFileUrl = Schema.makeFilter(
  (url: URL) => {
    const isSlackOrigin =
      url.protocol === OriginProtocol.Secure && url.hostname === SLACK_PRIVATE_FILE_HOST && url.port === '';

    const hasNoCredentials = url.username === '' && url.password === '';

    return isSlackOrigin && hasNoCredentials;
  },
  { expected: 'an HTTPS file on files.slack.com without embedded credentials' },
);

const SlackPrivateFileUrl = Schema.URLFromString.check(isPrivateFileUrl);

type ReadSlackImageInput = { readonly attachment: SlackAttachment; readonly token: Redacted.Redacted };
type DownloadSlackImageInput = { readonly url: URL; readonly token: Redacted.Redacted };
type ReceivedBytesInput = { readonly bytes: number };

/** Only Slack's file host receives the file-read credential; redirect bodies never enter the model. */
export async function readSlackImage({ attachment, token }: ReadSlackImageInput): Promise<SlackImageResult> {
  const url = attachment.url.pipe(
    Option.flatMap((value) => {
      const decoded = Schema.decodeUnknownResult(SlackPrivateFileUrl)(value);

      return Result.getSuccess(decoded);
    }),
  );

  if (Option.isNone(url)) {
    return SlackImageResult.cases.Unavailable.make({
      reason: 'the attachment has no supported private Slack file URL',
    });
  }

  const promise = downloadSlackImage({ url: url.value, token });
  const downloaded = await capturePromise({ promise });

  return Result.getOrElse(downloaded, () =>
    SlackImageResult.cases.Unavailable.make({
      reason: 'the image could not be downloaded within the time and size limits',
    }),
  );
}

async function downloadSlackImage({ url, token }: DownloadSlackImageInput): Promise<SlackImageResult> {
  const headers = { [HttpHeader.Authorization]: slackAuthorization({ token }) };
  const timeout = Duration.toMillis(SLACK_REQUEST_TIMEOUT);
  const signal = AbortSignal.timeout(timeout);
  const response = await fetch(url, { headers, method: HttpMethod.Get, signal, redirect: 'manual' });
  const received = { bytes: 0 };

  const accept: (input: ReceivedBytesInput) => boolean = ({ bytes }) => {
    received.bytes += bytes;

    return received.bytes <= SLACK_IMAGE_MAX_BYTES;
  };

  const bounded = await boundRemoteResponse({ response, accept });

  const buffer = await bounded.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (!bounded.ok) {
    return SlackImageResult.cases.Unavailable.make({
      reason: 'Slack did not allow the image download; check the installation has files:read',
    });
  }

  const contentType = bounded.headers.get(HttpHeader.ContentType);
  const header = Option.fromNullOr(contentType);

  const mediaType = header.pipe(
    Option.map((value) => value.replace(/;.*/u, '').trim().toLowerCase()),
    Option.flatMap((value) => {
      const decoded = Schema.decodeUnknownResult(SlackImageMediaType)(value);

      return Result.getSuccess(decoded);
    }),
  );

  if (Option.isNone(mediaType) || bytes.length === 0) {
    return SlackImageResult.cases.Unavailable.make({
      reason: 'the attachment did not contain a supported JPEG, PNG, GIF, or WebP image',
    });
  }

  const base64 = Base64.encode(bytes);

  return SlackImageResult.cases.Image.make({ base64, mediaType: mediaType.value });
}
