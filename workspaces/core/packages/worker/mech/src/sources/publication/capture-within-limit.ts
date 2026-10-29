import { SOURCE_PATCH_MAX_BYTES } from '@mechane/records';
import type { SourceChange, SourceChanges } from '@mechane/records';
import { Option, Result } from 'effect';
import { Base64 } from 'effect/encoding';

type CaptureWithinLimitInput = { readonly changes: SourceChanges };
type CapturedFileBytesInput = { readonly change: SourceChange };

/** Host validation bounds decoded bytes before persisting guest content or minting write authority. */
export function captureWithinLimit({ changes }: CaptureWithinLimitInput): boolean {
  const size = { bytes: 0 };

  for (const change of changes) {
    const bytes = capturedFileBytes({ change });

    if (Option.isNone(bytes)) {
      return false;
    }

    size.bytes += bytes.value;
  }

  return size.bytes <= SOURCE_PATCH_MAX_BYTES;
}

function capturedFileBytes({ change }: CapturedFileBytesInput): Option.Option<number> {
  if (Option.isSome(change.base64) !== Option.isSome(change.mode)) {
    return Option.none();
  }

  if (Option.isNone(change.base64)) {
    return Option.some(0);
  }

  const content = Base64.decode(change.base64.value);

  if (Result.isFailure(content) || Base64.encode(content.success) !== change.base64.value) {
    return Option.none();
  }

  return Option.some(content.success.byteLength);
}
