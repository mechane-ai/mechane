import { Bytes } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { WORKSPACE_ARCHIVE_MAX_BYTES, WORKSPACE_MAX_BYTES, WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';
import { workspaceFilePath } from '../workspace/workspace-file-path.ts';
import { boundedArchive } from './bounded-archive.ts';
import { ARCHIVE_FILE, WORKSPACE_TRANSFER_TIMEOUT } from './constants.ts';
import type { ArchiveProcess } from './types.ts';

/** A stream failure kept only until a known size-limit failure is distinguished from a foreign stream error. */
class ArchivePipelineFailed extends Schema.TaggedError<ArchivePipelineFailed>()('ArchivePipelineFailed', {
  streamError: Schema.Unknown,
}) {}

type CompressWorkspaceArchiveInput = WorkspaceFilesInput & Pick<ArchiveProcess, 'child'>;
type ArchiveFailureInput = { readonly generation: RecordId; readonly failure: ArchivePipelineFailed };

/** Enforces both archive byte limits while compressing and refuses a pipeline that exceeds its deadline. */
export const compressWorkspaceArchive = Effect.fn('compressWorkspaceArchive')(function* ({
  generation,
  folder,
  child,
}: CompressWorkspaceArchiveInput): Effect.fn.Return<void, WorkspaceFailed> {
  const path = workspaceFilePath({ folder, generation, file: ARCHIVE_FILE });
  const rawBytes = Bytes.make(WORKSPACE_MAX_BYTES);
  const compressedBytes = Bytes.make(WORKSPACE_ARCHIVE_MAX_BYTES);
  const raw = boundedArchive({ generation, maximumBytes: rawBytes });
  const compressed = boundedArchive({ generation, maximumBytes: compressedBytes });
  const gzip = createGzip();
  const file = createWriteStream(path);

  yield* Effect.tryPromise({
    try: () => pipeline(child.stdout, raw, gzip, compressed, file),
    catch: (streamError) => new ArchivePipelineFailed({ streamError }),
  }).pipe(
    Effect.catchTags({ ArchivePipelineFailed: (failure) => archiveFailure({ generation, failure }) }),
    Effect.timeoutOrElse({
      duration: WORKSPACE_TRANSFER_TIMEOUT,
      orElse: () =>
        new WorkspaceFailed({
          generation,
          step: WorkspaceStep.Archive,
          reason: 'workspace archive exceeded its deadline',
        }),
    }),
  );
});

/** Preserves an explicit byte-limit failure and exposes only text from other stream errors. */
const archiveFailure = Effect.fn('archiveFailure')(function* ({
  generation,
  failure,
}: ArchiveFailureInput): Effect.fn.Return<never, WorkspaceFailed> {
  if (Schema.is(WorkspaceFailed)(failure.streamError)) {
    return yield* failure.streamError;
  }

  const reason = String(failure.streamError);

  return yield* new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason });
});
