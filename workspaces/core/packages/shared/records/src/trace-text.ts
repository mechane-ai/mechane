import { Option } from 'effect';
import type { Bytes } from './schemas.ts';

export type TraceText = { readonly text: string; readonly omittedBytes: typeof Bytes.Encoded };

const TRACE_TEXT_KEEP = { Start: 'start', End: 'end' } as const;

type BoundTraceTextInput = TraceText & {
  readonly maxBytes: typeof Bytes.Encoded;
  readonly keep: (typeof TRACE_TEXT_KEEP)[keyof typeof TRACE_TEXT_KEEP];
};

const UTF8_CONTINUATION_MIN_BYTE = 0x80;
const UTF8_CONTINUATION_MAX_BYTE = 0xbf;

/** Preserve complete UTF-8 characters and count every byte excluded from this preview. */
export function boundTraceText({ text, omittedBytes, maxBytes, keep }: BoundTraceTextInput): TraceText {
  const encoded = new TextEncoder().encode(text);

  if (encoded.byteLength <= maxBytes) {
    return { text, omittedBytes };
  }

  const preview = selectTraceText({ encoded, maxBytes, keep });
  const retainedBytes = new TextEncoder().encode(preview).byteLength;

  return { text: preview, omittedBytes: omittedBytes + encoded.byteLength - retainedBytes };
}

type SelectTraceTextInput = Pick<BoundTraceTextInput, 'maxBytes' | 'keep'> & { readonly encoded: Uint8Array };

function selectTraceText({ encoded, maxBytes, keep }: SelectTraceTextInput): string {
  if (keep === TRACE_TEXT_KEEP.Start) {
    const selected = encoded.subarray(0, maxBytes);

    return new TextDecoder().decode(selected, { stream: true });
  }

  const start = { offset: encoded.byteLength - maxBytes };

  while (start.offset < encoded.byteLength) {
    const byte = Option.fromUndefinedOr(encoded[start.offset]);

    const isContinuation =
      Option.isSome(byte) && byte.value >= UTF8_CONTINUATION_MIN_BYTE && byte.value <= UTF8_CONTINUATION_MAX_BYTE;

    if (!isContinuation) {
      break;
    }

    start.offset += 1;
  }

  const selected = encoded.subarray(start.offset);

  return new TextDecoder().decode(selected);
}
