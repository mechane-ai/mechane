import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import type { RunFailure } from '@mechane/cli-kernel';
import { SANDBOX_ARCHIVE_PART_BYTES } from '@mechane/protocol';
import { Effect } from 'effect';
import { Buffer } from 'node:buffer';
import type { FileHandle } from 'node:fs/promises';

type ReadImportPartInput = { readonly handle: FileHandle; readonly part: number; readonly bytes: number };

type ReadImportSliceInput = {
  readonly handle: FileHandle;
  readonly buffer: Buffer;
  readonly position: number;
  readonly offset: number;
};

/** Resumes short filesystem reads without buffering more than one transfer part. */
export const readImportPart = Effect.fn('readImportPart')(function* ({
  handle,
  part,
  bytes,
}: ReadImportPartInput): Effect.fn.Return<Buffer, RunFailure> {
  const position = part * SANDBOX_ARCHIVE_PART_BYTES;
  const length = Math.min(SANDBOX_ARCHIVE_PART_BYTES, bytes - position);
  const buffer = Buffer.alloc(length);

  for (let offset = 0; offset < length;) {
    offset = yield* readImportSlice({ handle, buffer, position, offset });
  }

  return buffer;
});

const readImportSlice = Effect.fn('readImportSlice')(function* ({
  handle,
  buffer,
  position,
  offset,
}: ReadImportSliceInput): Effect.fn.Return<number, RunFailure> {
  const length = buffer.byteLength - offset;
  const at = position + offset;

  const read = yield* Effect.tryPromise({
    try: () => handle.read(buffer, offset, length, at),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not read import archive' }),
  });

  if (read.bytesRead === 0) {
    return yield* new SandboxMaintenanceFailed({ reason: 'archive ended before its recorded size' });
  }

  return offset + read.bytesRead;
});
