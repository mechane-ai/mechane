import { writeDiagnostic } from '@mechane/program';
import { RequestInvalid } from '@mechane/protocol';
import { MediaType } from '@mechane/records';
import type { EvidenceExportFile, EvidenceExportMetadata } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, open, rename, rm } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { join } from 'node:path';

const OWNER_DIRECTORY_MODE = 0o700;
const OWNER_FILE_MODE = 0o600;
const EXTENSIONS = { [MediaType.Png]: 'png', [MediaType.Jpeg]: 'jpg', [MediaType.Mp4]: 'mp4' } as const;

type WriteEvidenceInput = {
  readonly home: string;
  readonly metadata: EvidenceExportMetadata;
  readonly bytes: Uint8Array;
};

/** Atomic replacement makes a repeated copy safe even after its response was lost. */
export const writeEvidenceFile = Effect.fn('writeEvidenceFile')(function* ({
  home,
  metadata,
  bytes,
}: WriteEvidenceInput): Effect.fn.Return<EvidenceExportFile, RequestInvalid, Scope.Scope> {
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  if (bytes.byteLength !== metadata.sizeBytes || sha256 !== metadata.sha256) {
    return yield* new RequestInvalid({ reason: 'evidence export differs from its saved capture' });
  }

  const directory = join(home, '.mechane-evidence');

  yield* Effect.tryPromise({
    try: () => mkdir(directory, { recursive: true, mode: OWNER_DIRECTORY_MODE }),
    catch: () => new RequestInvalid({ reason: 'evidence export could not create its directory' }),
  });

  const entry = yield* Effect.tryPromise({
    try: () => lstat(directory),
    catch: () => new RequestInvalid({ reason: 'evidence export could not inspect its directory' }),
  });

  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    return yield* new RequestInvalid({ reason: 'evidence export directory is not a regular directory' });
  }

  const extension = EXTENSIONS[metadata.mediaType];
  const path = join(directory, `${metadata.artifactId}.${extension}`);
  const pending = yield* evidenceScratch({ directory });
  const temporary = join(pending, 'content');
  const file = yield* evidenceFile({ path: temporary, mode: 'wx' });

  yield* Effect.tryPromise({
    try: () => file.writeFile(bytes),
    catch: () => new RequestInvalid({ reason: 'evidence export could not write its capture' }),
  });
  yield* Effect.tryPromise({
    try: () => file.sync(),
    catch: () => new RequestInvalid({ reason: 'evidence export could not sync its capture' }),
  });
  yield* Effect.tryPromise({
    try: () => rename(temporary, path),
    catch: () => new RequestInvalid({ reason: 'evidence export could not commit its capture' }),
  });

  const folder = yield* evidenceFile({ path: directory, mode: 'r' });

  yield* Effect.tryPromise({
    try: () => folder.sync(),
    catch: () => new RequestInvalid({ reason: 'evidence export could not sync its directory' }),
  });
  yield* removeScratch({ path: pending });

  return { ...metadata, path };
});

type EvidenceFileInput = { readonly path: string; readonly mode: 'r' | 'wx' };

const evidenceFile = Effect.fn('evidenceFile')(function* ({
  path,
  mode,
}: EvidenceFileInput): Effect.fn.Return<FileHandle, RequestInvalid, Scope.Scope> {
  const opening = Effect.tryPromise({
    try: () => open(path, mode, OWNER_FILE_MODE),
    catch: () => new RequestInvalid({ reason: 'evidence export could not open its file' }),
  });

  const release: (handle: FileHandle) => Effect.Effect<void> = (handle) => {
    const closing = Effect.tryPromise({
      try: () => handle.close(),
      catch: () => new RequestInvalid({ reason: 'evidence export could not close its file' }),
    });

    return closing.pipe(Effect.catchTags(CLEANUP_RECOVERY));
  };

  return yield* Effect.acquireRelease(opening, release);
});

type EvidenceScratchInput = { readonly directory: string };

const evidenceScratch = Effect.fn('evidenceScratch')(function* ({
  directory,
}: EvidenceScratchInput): Effect.fn.Return<string, RequestInvalid, Scope.Scope> {
  const prefix = join(directory, '.pending-');

  const opening = Effect.tryPromise({
    try: () => mkdtemp(prefix),
    catch: () => new RequestInvalid({ reason: 'evidence export could not create its temporary directory' }),
  });

  const release: (path: string) => Effect.Effect<void> = (path) => {
    const removing = removeScratch({ path });

    return removing.pipe(Effect.catchTags(CLEANUP_RECOVERY));
  };

  return yield* Effect.acquireRelease(opening, release);
});

type RemoveScratchInput = { readonly path: string };

const removeScratch = Effect.fn('removeScratch')(function* ({
  path,
}: RemoveScratchInput): Effect.fn.Return<void, RequestInvalid> {
  yield* Effect.tryPromise({
    try: () => rm(path, { recursive: true, force: true }),
    catch: () => new RequestInvalid({ reason: 'evidence export could not remove its temporary directory' }),
  });
});

type CleanupFailureInput = Pick<RequestInvalid, 'reason'>;

const reportCleanupFailure: (input: CleanupFailureInput) => Effect.Effect<void> = ({ reason }) => {
  writeDiagnostic({ program: 'mechane-guest', line: reason });

  return Effect.void;
};

type CleanupRecovery = { readonly RequestInvalid: typeof reportCleanupFailure };
const CLEANUP_RECOVERY: Readonly<CleanupRecovery> = { RequestInvalid: reportCleanupFailure };
