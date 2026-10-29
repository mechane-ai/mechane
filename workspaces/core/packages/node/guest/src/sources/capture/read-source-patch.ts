import { Bytes, SOURCE_PATCH_MAX_BYTES } from '@mechane/records';
import type { SourceId } from '@mechane/records';
import { Effect, Option } from 'effect';
import { SourceGuestFailed } from '../../errors.ts';
import { readSourceChange } from './read-source-change.ts';
import type { SourcePatch } from './types.ts';

/** The next requested path and the already bounded prefix. */
type ReadSourcePatchInput = {
  readonly sourceId: SourceId;
  readonly folder: string;
  readonly path: string;
  readonly patch: SourcePatch;
};

/** Adds one change only when its content keeps the entire patch within the source byte limit. */
export const readSourcePatch = Effect.fn('readSourcePatch')(function* ({
  sourceId,
  folder,
  path,
  patch,
}: ReadSourcePatchInput): Effect.fn.Return<SourcePatch, SourceGuestFailed> {
  const change = yield* readSourceChange({ sourceId, folder, path });

  const addedBytes = Option.match(change.base64, {
    onNone: () => 0,
    onSome: (encoded) => Buffer.byteLength(encoded, 'base64'),
  });

  const totalBytes = patch.bytes + addedBytes;

  if (totalBytes > SOURCE_PATCH_MAX_BYTES) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'source patch exceeds its byte limit' });
  }

  return { changes: [...patch.changes, change], bytes: Bytes.make(totalBytes) };
});
