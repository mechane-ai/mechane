import type { BetaManagedAgentsFileResource } from '@anthropic-ai/sdk/resources/beta/sessions/resources';
import { HttpHeader } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import { lstatSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { mkdir, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { acquireStagedDirectory } from './mount-stage.ts';

const WORKSPACE_PREFIX = '/workspace/';
const SESSION_MNT_PREFIX = '/mnt/session/';
const ANTHROPIC_VERSION = '2026-10-21';
const FILES_BETA = 'files-api-2025-04-14';
const STAGED_FILE_NAME = 'payload';
const ASCII_SPACE = 32;
const ASCII_DELETE = 127;
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..', '.git']);

type FileMountInput = {
  readonly origin: string;
  readonly resource: BetaManagedAgentsFileResource;
  readonly token: string;
  readonly transport: typeof fetch;
  readonly workspace: string;
  readonly signal: AbortSignal;
};

type FilePathInput = { readonly path: string };
type FileTargetInput = { readonly workspace: string; readonly path: string };
type FileResourceInput = { readonly resource: BetaManagedAgentsFileResource };
type CharacterInput = { readonly character: string };
type SegmentInput = { readonly segment: string };

class FileMountFailed extends Schema.TaggedError<FileMountFailed>()('FileMountFailed', { reason: Schema.String }) {
  override get message(): string {
    return this.reason;
  }
}

function fileContentPath({ resource }: FileResourceInput): string {
  const encoded = encodeURIComponent(resource.file_id);

  return ['', 'v1', 'files', encoded, 'content'].join('/');
}

const inspectEntry = Effect.fn('inspectEntry')(function* ({
  path,
}: FilePathInput): Effect.fn.Return<Option.Option<Stats>, FileMountFailed> {
  const details = yield* Effect.try({
    try: () => lstatSync(path, { throwIfNoEntry: false }),
    catch: (cause) => new FileMountFailed({ reason: String(cause) }),
  });

  return Option.fromNullishOr(details);
});

function isSafeCharacter({ character }: CharacterInput): boolean {
  const point = character.codePointAt(0);
  const codeOption = Option.fromNullishOr(point);
  const code = Option.getOrElse(codeOption, () => 0);

  return code >= ASCII_SPACE && code !== ASCII_DELETE;
}

function isSafeSegment({ segment }: SegmentInput): boolean {
  const normalized = segment.toLowerCase();

  if (RESERVED_SEGMENTS.has(normalized)) {
    return false;
  }

  const characters = Array.from(segment);

  return characters.every((character) => isSafeCharacter({ character }));
}

function relativeSegments({ path }: FilePathInput): Option.Option<ReadonlyArray<string>> {
  if (!path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    return Option.none();
  }

  let relative = path.slice(1);

  if (path.startsWith(WORKSPACE_PREFIX)) {
    relative = path.slice(WORKSPACE_PREFIX.length);
  } else if (path.startsWith(SESSION_MNT_PREFIX)) {
    relative = path.slice(SESSION_MNT_PREFIX.length);
  }

  const segments = relative.split('/');

  if (segments.length === 0 || !segments.every((segment) => isSafeSegment({ segment }))) {
    return Option.none();
  }

  return Option.some(segments);
}

const resolveMountFile = Effect.fn('resolveMountFile')(function* ({
  workspace,
  path,
}: FileTargetInput): Effect.fn.Return<string, FileMountFailed> {
  const segments = relativeSegments({ path });

  if (Option.isNone(segments)) {
    return yield* new FileMountFailed({ reason: 'Invalid file resource mount path' });
  }

  const root = yield* Effect.tryPromise({
    try: () => realpath(workspace),
    catch: (cause) => new FileMountFailed({ reason: String(cause) }),
  });

  const ancestors = segments.value.slice(0, -1);

  for (const index of ancestors.keys()) {
    const parts = ancestors.slice(0, index + 1);
    const directory = join(root, ...parts);
    const details = yield* inspectEntry({ path: directory });

    if (Option.isNone(details)) {
      yield* Effect.tryPromise({
        try: () => mkdir(directory),
        catch: (cause) => new FileMountFailed({ reason: String(cause) }),
      });
    } else if (!details.value.isDirectory()) {
      return yield* new FileMountFailed({ reason: 'File mount parent must be a real directory' });
    }
  }

  return join(root, ...segments.value);
});

export const mountSessionFile = Effect.fn('mountSessionFile')(function* ({
  origin,
  resource,
  token,
  transport,
  workspace,
  signal,
}: FileMountInput): Effect.fn.Return<void, FileMountFailed, Scope.Scope> {
  const target = yield* resolveMountFile({ workspace, path: resource.mount_path });
  const existing = yield* inspectEntry({ path: target });

  if (Option.isSome(existing)) {
    if (existing.value.isFile()) {
      return;
    }

    return yield* new FileMountFailed({ reason: 'File resource mount path is occupied by a non-file' });
  }

  const route = fileContentPath({ resource });
  const url = new URL(route, origin);

  const response = yield* Effect.tryPromise({
    try: () =>
      transport(url, {
        headers: {
          [HttpHeader.Authorization]: `Bearer ${token}`,
          [HttpHeader.AnthropicVersion]: ANTHROPIC_VERSION,
          [HttpHeader.AnthropicBeta]: FILES_BETA,
        },
        signal,
        redirect: 'error',
      }),
    catch: () => new FileMountFailed({ reason: `Cannot reach file service for ${resource.file_id}` }),
  });

  if (!response.ok) {
    return yield* new FileMountFailed({
      reason: `File download for ${resource.file_id} failed with HTTP ${response.status}`,
    });
  }

  const buffer = yield* Effect.tryPromise({
    try: () => response.arrayBuffer(),
    catch: (cause) => new FileMountFailed({ reason: String(cause) }),
  });

  const bytes = new Uint8Array(buffer);
  const parent = dirname(target);
  const staged = acquireStagedDirectory({ parent, prefix: '.mechane-file-' });

  const stage = yield* Effect.mapError(staged, (cause) => new FileMountFailed({ reason: cause.reason }));

  const stagedFile = join(stage, STAGED_FILE_NAME);

  yield* Effect.tryPromise({
    try: () => writeFile(stagedFile, bytes, { flag: 'wx', mode: 0o600 }),
    catch: (cause) => new FileMountFailed({ reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => rename(stagedFile, target),
    catch: (cause) => new FileMountFailed({ reason: String(cause) }),
  });
}, Effect.scoped);
