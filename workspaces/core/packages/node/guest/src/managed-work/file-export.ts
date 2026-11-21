import { Bytes, BYTES_PER_MEBIBYTE, HttpHeader, HttpMethod } from '@mechane/records';
import { DateTime, Effect, MutableRef, Option, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { lstatSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';

const OUTPUTS_DIRECTORY = 'outputs';
const ANTHROPIC_VERSION = '2026-10-21';
const FILES_BETA = 'files-api-2025-04-14';
const EXPORT_FILE_MAX_MEBIBYTES = 32;
const EXPORT_SESSION_MAX_MEBIBYTES = 64;
const EXPORT_FILE_MAX_BYTES = EXPORT_FILE_MAX_MEBIBYTES * BYTES_PER_MEBIBYTE;
const EXPORT_SESSION_MAX_BYTES = EXPORT_SESSION_MAX_MEBIBYTES * BYTES_PER_MEBIBYTE;
const EXPORT_FILES_MAX_COUNT = 64;
const EXPORT_DEPTH_MAX_LEVELS = 4;
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..', '.git']);

class FileExportFailed extends Schema.TaggedError<FileExportFailed>()('FileExportFailed', { reason: Schema.String }) {}

type UploadedOutput = { readonly size: Bytes; readonly modifiedAt: DateTime.Utc; readonly sha256: string };
type StatLookupInput = { readonly relativePath: string; readonly size: Bytes; readonly modifiedAt: DateTime.Utc };
type DigestCheckInput = StatLookupInput & { readonly sha256: string };
type ByteBudgetInput = { readonly size: Bytes };
type DigestInput = { readonly bytes: Uint8Array };
type RelativePathInput = { readonly relativePath: string };

/** Per-session tracking state for deduplicating and bounding exported outputs. */
export type OutputExportState = {
  readonly isStatUnchanged: (input: StatLookupInput) => boolean;
  readonly isFileLimitReached: () => boolean;
  readonly isContentUnchanged: (input: DigestCheckInput) => boolean;
  readonly canAddBytes: (input: ByteBudgetInput) => boolean;
  readonly recordUpload: (input: DigestCheckInput) => void;
};

type ExportSessionOutputsInput = {
  readonly origin: string;
  readonly token: string;
  readonly transport: typeof fetch;
  readonly workspace: string;
  readonly signal: AbortSignal;
  readonly state: OutputExportState;
};

type PathInput = { readonly path: string };
type SegmentInput = { readonly segment: string };
type RelativeEntryInput = { readonly entry: string };
type CandidateInput = { readonly outputsRoot: string; readonly relativePath: string };
type UploadCandidate = { readonly relativePath: string; readonly absolutePath: string; readonly stats: Stats };

type UploadFileInput = {
  readonly origin: string;
  readonly token: string;
  readonly transport: typeof fetch;
  readonly signal: AbortSignal;
  readonly candidate: UploadCandidate;
  readonly state: OutputExportState;
};

/** Creates empty deduplication and quota tracking state for one worker session. */
export function createOutputExportState(): OutputExportState {
  const uploaded = new Map<string, UploadedOutput>();
  const initialBytes = Bytes.make(0);
  const totalBytes = MutableRef.make(initialBytes);
  const totalFiles = MutableRef.make(0);

  function lookup({ relativePath }: RelativePathInput): Option.Option<UploadedOutput> {
    const existing = uploaded.get(relativePath);

    return Option.fromNullishOr(existing);
  }

  function isStatUnchanged({ relativePath, size, modifiedAt }: StatLookupInput): boolean {
    const previous = lookup({ relativePath });

    if (Option.isNone(previous)) {
      return false;
    }

    const previousMillis = DateTime.toEpochMillis(previous.value.modifiedAt);
    const currentMillis = DateTime.toEpochMillis(modifiedAt);

    return previous.value.size === size && previousMillis === currentMillis;
  }

  function isFileLimitReached(): boolean {
    return MutableRef.get(totalFiles) >= EXPORT_FILES_MAX_COUNT;
  }

  function isContentUnchanged({ relativePath, size, modifiedAt, sha256 }: DigestCheckInput): boolean {
    const previous = lookup({ relativePath });

    if (Option.isSome(previous) && previous.value.sha256 === sha256) {
      uploaded.set(relativePath, { size, modifiedAt, sha256 });

      return true;
    }

    return false;
  }

  function canAddBytes({ size }: ByteBudgetInput): boolean {
    return MutableRef.get(totalBytes) + size <= EXPORT_SESSION_MAX_BYTES;
  }

  function recordUpload({ relativePath, size, modifiedAt, sha256 }: DigestCheckInput): void {
    uploaded.set(relativePath, { size, modifiedAt, sha256 });
    MutableRef.update(totalBytes, (used) => Bytes.make(used + size));
    MutableRef.update(totalFiles, (count) => count + 1);
  }

  return { isStatUnchanged, isFileLimitReached, isContentUnchanged, canAddBytes, recordUpload };
}

function filesUploadPath(): string {
  return ['', 'v1', 'files'].join('/');
}

const inspectPath = Effect.fn('inspectPath')(function* ({
  path,
}: PathInput): Effect.fn.Return<Option.Option<Stats>, FileExportFailed> {
  const details = yield* Effect.try({
    try: () => lstatSync(path, { throwIfNoEntry: false }),
    catch: (cause) => new FileExportFailed({ reason: String(cause) }),
  });

  return Option.fromNullishOr(details);
});

function isExportableSegment({ segment }: SegmentInput): boolean {
  const normalized = segment.toLowerCase();

  if (RESERVED_SEGMENTS.has(normalized) || segment.startsWith('.')) {
    return false;
  }

  return !segment.includes('\0');
}

function parseRelativeSegments({ entry }: RelativeEntryInput): Option.Option<ReadonlyArray<string>> {
  const normalized = entry.replaceAll('\\', '/');
  const segments = normalized.split('/');

  if (segments.length === 0 || segments.length > EXPORT_DEPTH_MAX_LEVELS) {
    return Option.none();
  }

  const isSafe = segments.every((segment) => isExportableSegment({ segment }));

  if (!isSafe) {
    return Option.none();
  }

  return Option.some(segments);
}

const resolveSafeCandidate = Effect.fn('resolveSafeCandidate')(function* ({
  outputsRoot,
  relativePath,
}: CandidateInput): Effect.fn.Return<Option.Option<UploadCandidate>, FileExportFailed> {
  const parsed = parseRelativeSegments({ entry: relativePath });

  if (Option.isNone(parsed)) {
    return Option.none();
  }

  const segments = parsed.value;
  const ancestors = segments.slice(0, -1);

  for (const index of ancestors.keys()) {
    const prefixParts = ancestors.slice(0, index + 1);
    const directoryPath = join(outputsRoot, ...prefixParts);
    const directoryStats = yield* inspectPath({ path: directoryPath });

    if (Option.isNone(directoryStats) || directoryStats.value.isSymbolicLink() || !directoryStats.value.isDirectory()) {
      return Option.none();
    }
  }

  const absolutePath = join(outputsRoot, ...segments);
  const entryStats = yield* inspectPath({ path: absolutePath });

  if (Option.isNone(entryStats) || entryStats.value.isSymbolicLink() || !entryStats.value.isFile()) {
    return Option.none();
  }

  const canonicalPath = yield* Effect.tryPromise({
    try: () => realpath(absolutePath),
    catch: (cause) => new FileExportFailed({ reason: String(cause) }),
  });

  const requiredPrefix = `${outputsRoot}${sep}`;

  if (!canonicalPath.startsWith(requiredPrefix)) {
    return Option.none();
  }

  const canonicalRelative = segments.join('/');

  return Option.some({ relativePath: canonicalRelative, absolutePath: canonicalPath, stats: entryStats.value });
});

function sha256Digest({ bytes }: DigestInput): string {
  const hash = createHash('sha256');

  hash.update(bytes);

  return hash.digest('hex');
}

function uploadFilename({ relativePath }: RelativePathInput): string {
  return relativePath.replaceAll('/', '__');
}

const uploadCandidateIfChanged = Effect.fn('uploadCandidateIfChanged')(function* ({
  origin,
  token,
  transport,
  signal,
  candidate,
  state,
}: UploadFileInput): Effect.fn.Return<void, FileExportFailed> {
  if (signal.aborted) {
    return;
  }

  const { relativePath, absolutePath, stats } = candidate;

  if (stats.size > EXPORT_FILE_MAX_BYTES) {
    return;
  }

  const statSize = Bytes.make(stats.size);
  const modifiedAt = DateTime.makeUnsafe(stats.mtimeMs);

  if (state.isStatUnchanged({ relativePath, size: statSize, modifiedAt })) {
    return;
  }

  if (state.isFileLimitReached()) {
    return;
  }

  const buffer = yield* Effect.tryPromise({
    try: () => readFile(absolutePath),
    catch: (cause) => new FileExportFailed({ reason: String(cause) }),
  });

  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  if (bytes.byteLength > EXPORT_FILE_MAX_BYTES) {
    return;
  }

  const size = Bytes.make(bytes.byteLength);
  const digest = sha256Digest({ bytes });

  if (state.isContentUnchanged({ relativePath, size, modifiedAt, sha256: digest })) {
    return;
  }

  if (!state.canAddBytes({ size })) {
    return;
  }

  const form = new FormData();
  const payload = new Blob([bytes]);
  const filename = uploadFilename({ relativePath });

  form.append('file', payload, filename);

  const route = filesUploadPath();
  const url = new URL(route, origin);

  const headers = {
    [HttpHeader.Authorization]: `Bearer ${token}`,
    [HttpHeader.AnthropicVersion]: ANTHROPIC_VERSION,
    [HttpHeader.AnthropicBeta]: FILES_BETA,
  };

  const response = yield* Effect.tryPromise({
    try: () => transport(url, { method: HttpMethod.Post, headers, body: form, signal, redirect: 'error' }),
    catch: (cause) => new FileExportFailed({ reason: String(cause) }),
  });

  if (!response.ok) {
    return;
  }

  state.recordUpload({ relativePath, size, modifiedAt, sha256: digest });
});

/** Scans `/workspace/outputs/` safely and uploads new or modified files to the active session's file scope. */
export const exportSessionOutputs = Effect.fn('exportSessionOutputs')(function* ({
  origin,
  token,
  transport,
  workspace,
  signal,
  state,
}: ExportSessionOutputsInput): Effect.fn.Return<void, FileExportFailed> {
  if (signal.aborted) {
    return;
  }

  const root = yield* Effect.tryPromise({
    try: () => realpath(workspace),
    catch: (cause) => new FileExportFailed({ reason: String(cause) }),
  });

  const outputsPath = join(root, OUTPUTS_DIRECTORY);
  const outputsStats = yield* inspectPath({ path: outputsPath });

  if (Option.isNone(outputsStats) || outputsStats.value.isSymbolicLink() || !outputsStats.value.isDirectory()) {
    return;
  }

  const outputsRoot = yield* Effect.tryPromise({
    try: () => realpath(outputsPath),
    catch: (cause) => new FileExportFailed({ reason: String(cause) }),
  });

  const requiredWorkspacePrefix = `${root}${sep}`;

  if (!outputsRoot.startsWith(requiredWorkspacePrefix)) {
    return;
  }

  const entries = yield* Effect.tryPromise({
    try: () => readdir(outputsRoot, { recursive: true }),
    catch: (cause) => new FileExportFailed({ reason: String(cause) }),
  });

  const sortedEntries = entries.toSorted();

  const resolved = yield* Effect.forEach(
    sortedEntries,
    (relativePath) => resolveSafeCandidate({ outputsRoot, relativePath }),
    { concurrency: 1 },
  );

  const candidates = resolved
    .filter(Option.isSome)
    .map((entry) => entry.value)
    .slice(0, EXPORT_FILES_MAX_COUNT);

  yield* Effect.forEach(
    candidates,
    (candidate) => uploadCandidateIfChanged({ origin, token, transport, signal, candidate, state }),
    { concurrency: 1, discard: true },
  );
});
