import { Bytes } from '@mechane/records';
import type { EvidenceProvenance } from '@mechane/records';
import { BROWSER_ARTIFACT_PART_BYTES, BROWSER_RECORDING_MAX_BYTES, BrowserArtifact } from '@mechane/sandbox-wire';
import type { BrowserArtifactPart, BrowserArtifactPartRequest, BrowserTab } from '@mechane/sandbox-wire';
import { Duration, Effect, Option, Schema } from 'effect';
import type { DateTime, Scope } from 'effect';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { link, open, readFile, rm, writeFile } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { runBrowserChild } from '../browser-process.ts';
import type { BrowserChildren } from '../browser-process.ts';
import { BrowserFailed, BrowserFailureKind } from '../errors.ts';
import type { BrowserSettings } from '../types.ts';
import { ARTIFACT_SUFFIX, ARTIFACTS_DIRECTORY, METADATA_SUFFIX, PARTIAL_SUFFIX, PREVIEW_SUFFIX } from './constants.ts';
import { prepareDirectory } from './prepare-directory.ts';

const BrowserArtifactJson = Schema.fromJsonString(BrowserArtifact);
const PREVIEW_ENCODING_TIMEOUT = Duration.seconds(10);
const PRIVATE_FILE_MODE = 0o600;

type ArtifactIdentity = { readonly settings: BrowserSettings; readonly artifactId: BrowserArtifact['artifactId'] };

type SaveBrowserArtifactInput = ArtifactIdentity & {
  readonly bytes: Uint8Array;
  readonly mediaType: BrowserArtifact['mediaType'];
  readonly tab: BrowserTab;
  readonly duration: Duration.Duration;
  readonly capturedAt: DateTime.Utc;
  readonly provenance: EvidenceProvenance;
};

/** Commits immutable capture bytes and their hash outside workspace checkpoints. */
export const saveBrowserArtifact = Effect.fn('saveBrowserArtifact')(function* ({
  settings,
  artifactId,
  bytes,
  mediaType,
  tab,
  duration,
  capturedAt,
  provenance,
}: SaveBrowserArtifactInput): Effect.fn.Return<BrowserArtifact, BrowserFailed, Scope.Scope> {
  if (bytes.byteLength > BROWSER_RECORDING_MAX_BYTES) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Capacity,
      reason: 'browser artifact exceeds its byte limit',
    });
  }

  const artifactFolder = join(settings.scratchDirectory, ARTIFACTS_DIRECTORY);
  const suffix = ARTIFACT_SUFFIX[mediaType];
  const filename = `${artifactId}${suffix}`;
  const path = join(artifactFolder, filename);
  const hash = createHash('sha256').update(bytes).digest('hex');

  const sizeBytes = Bytes.make(bytes.byteLength);

  const artifact: BrowserArtifact = {
    artifactId,
    capturedAt,
    provenance,
    path,
    mediaType,
    sizeBytes,
    sha256: hash,
    widthPixels: tab.viewport.width,
    heightPixels: tab.viewport.height,
    duration,
    tabId: tab.tabId,
    url: tab.url,
  };

  const metadata = Schema.encodeSync(BrowserArtifactJson)(artifact);

  const temporary = `${path}${PARTIAL_SUFFIX}`;
  const metadataPath = join(artifactFolder, `${artifactId}${METADATA_SUFFIX}`);
  const metadataTemporary = `${metadataPath}${PARTIAL_SUFFIX}`;

  yield* prepareDirectory({ directory: artifactFolder });
  yield* stageArtifactFile({ path: temporary, contents: bytes });
  yield* stageArtifactFile({ path: metadataTemporary, contents: metadata });

  const publication = { isCommitted: false };

  const rollback = Effect.fn('rollback')(function* ({
    path: publishedPath,
  }: ArtifactFileInput): Effect.fn.Return<void, BrowserFailed> {
    if (publication.isCommitted) {
      return;
    }

    yield* Effect.tryPromise({
      try: () => rm(publishedPath, { force: true }),
      catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
    });
  });

  const publishingBytes = Effect.tryPromise({
    try: () => link(temporary, path),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  const publishingMetadata = Effect.tryPromise({
    try: () => link(metadataTemporary, metadataPath),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  yield* Effect.acquireRelease(publishingBytes, () => rollback({ path }).pipe(Effect.orDie));
  yield* Effect.acquireRelease(publishingMetadata, () => rollback({ path: metadataPath }).pipe(Effect.orDie));

  publication.isCommitted = true;

  return artifact;
}, Effect.scoped);

type ArtifactFileInput = { readonly path: string };
type StageArtifactFileInput = ArtifactFileInput & { readonly contents: string | Uint8Array };

const stageArtifactFile = Effect.fn('stageArtifactFile')(function* ({
  path,
  contents,
}: StageArtifactFileInput): Effect.fn.Return<void, BrowserFailed, Scope.Scope> {
  const opening = Effect.tryPromise({
    try: () => open(path, 'wx', PRIVATE_FILE_MODE),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  const release = Effect.fn('release')(function* (opened: FileHandle): Effect.fn.Return<void, BrowserFailed> {
    const closing = Effect.tryPromise({
      try: () => opened.close(),
      catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
    });

    const state = { failure: Option.none<BrowserFailed>() };

    yield* closing.pipe(
      Effect.catchTags({
        BrowserFailed: (failed) =>
          Effect.sync(() => {
            state.failure = Option.some(failed);
          }),
      }),
    );

    yield* Effect.tryPromise({
      try: () => rm(path, { force: true }),
      catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
    });

    if (Option.isSome(state.failure)) {
      return yield* state.failure.value;
    }
  });

  const file = yield* Effect.acquireRelease(opening, (opened) => release(opened).pipe(Effect.orDie));

  yield* Effect.tryPromise({
    try: () => file.writeFile(contents),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });
});

type ReadBrowserArtifactPartInput = BrowserArtifactPartRequest & { readonly settings: BrowserSettings };

const readBrowserArtifact = Effect.fn('readBrowserArtifact')(function* ({
  settings,
  artifactId,
}: ArtifactIdentity): Effect.fn.Return<BrowserArtifact, BrowserFailed> {
  const metadataPath = join(settings.scratchDirectory, ARTIFACTS_DIRECTORY, `${artifactId}${METADATA_SUFFIX}`);

  const serialized = yield* Effect.tryPromise({
    try: () => readFile(metadataPath, 'utf8'),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  const artifact = yield* Schema.decodeUnknownEffect(BrowserArtifactJson, { onExcessProperty: 'error' })(
    serialized,
  ).pipe(
    Effect.mapError(
      () => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: 'browser artifact metadata is invalid' }),
    ),
  );

  if (artifact.artifactId !== artifactId) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Storage,
      reason: 'browser artifact metadata does not match its identity',
    });
  }

  return artifact;
});

type ReadBrowserArtifactPreviewInput = ArtifactIdentity & {
  readonly children: BrowserChildren;
  readonly widthPixels: number;
  readonly heightPixels: number;
};

/** Derives a transient JPEG from committed capture bytes; its temporary file stays owned by this store. */
export const readBrowserArtifactPreview = Effect.fn('readBrowserArtifactPreview')(function* ({
  settings,
  artifactId,
  children,
  widthPixels,
  heightPixels,
}: ReadBrowserArtifactPreviewInput): Effect.fn.Return<string, BrowserFailed, Scope.Scope> {
  const artifact = yield* readBrowserArtifact({ settings, artifactId });
  const suffix = ARTIFACT_SUFFIX[artifact.mediaType];
  const directory = join(settings.scratchDirectory, ARTIFACTS_DIRECTORY);
  const inputPath = join(directory, `${artifactId}${suffix}`);
  const outputPath = join(directory, `${artifactId}${PREVIEW_SUFFIX}`);

  const opening = Effect.tryPromise({
    try: () => writeFile(outputPath, '', { mode: 0o600, flag: 'wx' }),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  const removal = Effect.tryPromise({
    try: () => rm(outputPath, { force: true }),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  yield* Effect.acquireRelease(opening, () => removal.pipe(Effect.orDie));
  yield* runBrowserChild({
    command: settings.encoderExecutable,
    args: [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-vf',
      `scale=${widthPixels}:${heightPixels}`,
      outputPath,
    ],
    environment: { PATH: settings.path },
    children,
    timeout: PREVIEW_ENCODING_TIMEOUT,
  });

  const bytes = yield* Effect.tryPromise({
    try: () => readFile(outputPath),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  return bytes.toString('base64');
}, Effect.scoped);

/** Reads a bounded chunk by capture identity without accepting a caller-supplied filesystem path. */
export const readBrowserArtifactPart = Effect.fn('readBrowserArtifactPart')(function* ({
  settings,
  artifactId,
  offset,
}: ReadBrowserArtifactPartInput): Effect.fn.Return<BrowserArtifactPart, BrowserFailed, Scope.Scope> {
  const artifact = yield* readBrowserArtifact({ settings, artifactId });
  const suffix = ARTIFACT_SUFFIX[artifact.mediaType];
  const filename = join(settings.scratchDirectory, ARTIFACTS_DIRECTORY, `${artifactId}${suffix}`);

  if (offset > artifact.sizeBytes) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Target,
      reason: 'browser artifact offset exceeds its size',
    });
  }

  const opening = Effect.tryPromise({
    try: () => open(filename, constants.O_RDONLY + constants.O_NOFOLLOW),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  const release: (opened: FileHandle) => Effect.Effect<void> = (opened) => {
    const closing = Effect.tryPromise({
      try: () => opened.close(),
      catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
    });

    return closing.pipe(Effect.orDie);
  };

  const file = yield* Effect.acquireRelease(opening, release);

  const size = Math.min(BROWSER_ARTIFACT_PART_BYTES, artifact.sizeBytes - offset);
  const bytes = Buffer.alloc(size);

  const result = yield* Effect.tryPromise({
    try: () => file.read(bytes, 0, size, offset),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  if (result.bytesRead !== size) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Storage,
      reason: 'browser artifact changed after capture',
    });
  }

  const base64 = bytes.toString('base64');

  return { artifact, offset, base64, isLast: offset + size === artifact.sizeBytes };
}, Effect.scoped);
