import { DateTime, Duration, Option, Redacted, Result, Schema } from 'effect';

const SLACK_SIGNATURE_WINDOW = Duration.minutes(5);

const SlackSignatureHeaders = Schema.Struct({
  timestamp: Schema.String.check(Schema.isPattern(/^\d+$/)),
  signature: Schema.String.check(Schema.isPattern(/^v0=[a-f0-9]{64}$/)),
});

type SlackSignatureHeaders = typeof SlackSignatureHeaders.Type;

type VerifySlackSignatureInput = {
  readonly body: Uint8Array;
  /** Absent when the Slack timestamp header was not supplied. */
  readonly timestamp: Option.Option<string>;
  /** Absent when the Slack signature header was not supplied. */
  readonly signature: Option.Option<string>;
  readonly signingSecret: Redacted.Redacted;
  readonly now: DateTime.Utc;
};

type VerifySlackMacInput = Pick<VerifySlackSignatureInput, 'body' | 'signingSecret'> & {
  readonly headers: SlackSignatureHeaders;
};

const HEX_RADIX = 16;
const SIGNATURE_PREFIX = 'v0=';
const MILLISECONDS_PER_SECOND = 1000;

/** Checks freshness and the raw-body HMAC using the platform cryptographic verifier. */
export async function verifySlackSignature({
  body,
  timestamp,
  signature,
  signingSecret,
  now,
}: VerifySlackSignatureInput): Promise<boolean> {
  const timestampValue = Option.getOrNull(timestamp);
  const signatureValue = Option.getOrNull(signature);

  const headers = Schema.decodeUnknownResult(SlackSignatureHeaders)({
    timestamp: timestampValue,
    signature: signatureValue,
  });

  if (Result.isFailure(headers)) {
    return false;
  }

  const timestampMs = Number(headers.success.timestamp) * MILLISECONDS_PER_SECOND;
  const nowMs = DateTime.toEpochMillis(now);

  if (!Number.isSafeInteger(timestampMs) || Math.abs(nowMs - timestampMs) > Duration.toMillis(SLACK_SIGNATURE_WINDOW)) {
    return false;
  }

  return await verifySlackMac({ body, signingSecret, headers: headers.success });
}

async function verifySlackMac({ body, signingSecret, headers }: VerifySlackMacInput): Promise<boolean> {
  const encoder = new TextEncoder();
  const prefix = encoder.encode(`v0:${headers.timestamp}:`);
  const signed = new Uint8Array([...prefix, ...body]);
  const hex = headers.signature.slice(SIGNATURE_PREFIX.length);
  const matches = hex.match(/.{2}/g);
  const matched = Option.fromNullishOr(matches);
  const pairs = Option.getOrElse(matched, () => []);
  const digest = Uint8Array.from(pairs, (byte) => Number.parseInt(byte, HEX_RADIX));
  const secret = Redacted.value(signingSecret);
  const keyBytes = encoder.encode(secret);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

  return await crypto.subtle.verify('HMAC', key, digest, signed);
}
