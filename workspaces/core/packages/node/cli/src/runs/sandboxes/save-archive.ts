import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import type { RunFailure } from '@mechane/cli-kernel';
import type { SandboxArchive } from '@mechane/protocol';
import { Array, Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { createHash } from 'node:crypto';
import type { Hash } from 'node:crypto';
import type { FileHandle } from 'node:fs/promises';
import { resolve } from 'node:path';
import { downloadPart } from './download-part.ts';
import { openArchiveFile } from './open-archive-file.ts';
import { publishArchive } from './publish-archive.ts';
import type { SandboxCallInput } from './types.ts';

type SaveArchiveInput = SandboxCallInput & { readonly archive: SandboxArchive; readonly file: string };
type WriteArchivePartInput = SandboxCallInput & { readonly handle: FileHandle; readonly hash: Hash };

/** Publishes a complete checksum-verified archive without overwriting an existing destination. */
export const saveArchive = Effect.fn('saveArchive')(function* ({
  archive,
  file,
  ...input
}: SaveArchiveInput): Effect.fn.Return<string, RunFailure, Scope.Scope> {
  const destination = resolve(file);
  const operationId = Option.getOrElse(input.request.operationId, () => 'none');
  const temporary = `${destination}.partial-${operationId}`;
  const handle = yield* openArchiveFile({ path: temporary });
  const hash = createHash('sha256');

  const parts = Array.range(0, archive.parts - 1);

  for (const part of parts) {
    yield* writeArchivePart({ ...input, request: { ...input.request, part }, handle, hash });
  }

  yield* publishArchive({ handle, hash, archive, temporary, destination });

  return destination;
}, Effect.scoped);

const writeArchivePart = Effect.fn('writeArchivePart')(function* ({
  handle,
  hash,
  ...input
}: WriteArchivePartInput): Effect.fn.Return<void, RunFailure> {
  const bytes = yield* downloadPart(input);

  hash.update(bytes);
  yield* Effect.tryPromise({
    try: () => handle.writeFile(bytes),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not write archive part' }),
  });
});
