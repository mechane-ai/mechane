export type TraceText = { readonly text: string; readonly omittedBytes: number };

type BoundTraceTextInput = TraceText & { readonly maxBytes: number; readonly keep: 'start' | 'end' };

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
  if (keep === 'start') {
    return new TextDecoder().decode(encoded.subarray(0, maxBytes), { stream: true });
  }

  const start = { offset: encoded.byteLength - maxBytes };

  while (isContinuationByte(encoded[start.offset])) {
    start.offset += 1;
  }

  return new TextDecoder().decode(encoded.subarray(start.offset));
}

function isContinuationByte(byte: number | undefined): boolean {
  return byte !== undefined && byte >= UTF8_CONTINUATION_MIN_BYTE && byte <= UTF8_CONTINUATION_MAX_BYTE;
}
