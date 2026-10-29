import { SANDBOX_ARCHIVE_PART_BYTES } from '@mechane/protocol';
import type { RecordId } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import type { FileHandle } from 'node:fs/promises';
import { WorkspaceFailed } from '../errors.ts';

type ReadFilePartInput = { readonly file: FileHandle; readonly generation: RecordId };

/** A filesystem read may return fewer bytes than requested before the end of the file. */
export const readFilePart = Effect.fn('readFilePart')(function* ({
  file,
  generation,
}: ReadFilePartInput): Effect.fn.Return<Uint8Array, WorkspaceFailed> {
  const buffer = new Uint8Array(SANDBOX_ARCHIVE_PART_BYTES);
  const state = { offset: 0, isEnded: false };

  while (state.offset < buffer.byteLength && !state.isEnded) {
    const result = yield* Effect.tryPromise({
      try: () => file.read(buffer, state.offset, buffer.byteLength - state.offset, null),
      catch: (cause) => new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason: String(cause) }),
    });

    state.offset += result.bytesRead;
    state.isEnded = result.bytesRead === 0;
  }

  return buffer.slice(0, state.offset);
});
