import { ManagedStoreError } from '@mechane/control-store';
import { BYTES_PER_MEBIBYTE, HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import { ManagedHttpError } from './http-error.ts';
import { managedPageQuery } from './page-query.ts';
import type { ManagedRequest } from './types.ts';
import { readBoundedMultipartForm, sha256Hex } from './upload.ts';

const FILE_UPLOAD_MAX_MEBIBYTES = 32;
const FILE_UPLOAD_MAX_BYTES = FILE_UPLOAD_MAX_MEBIBYTES * BYTES_PER_MEBIBYTE;
const EXPIRES_MIN_SECONDS = 3600;
const EXPIRES_MAX_SECONDS = 7_776_000;
const MILLISECONDS_PER_SECOND = 1000;
const FILENAME_MAX_CHARS = 500;
const MIME_TYPE_MAX_CHARS = 255;
const ASCII_SPACE = 32;
const ASCII_DELETE = 127;
const DOT_NAMES: ReadonlySet<string> = new Set(['.', '..']);

const EXTENSION_MIME_TYPES: ReadonlyMap<string, string> = new Map([
  ['.txt', MediaType.PlainText],
  ['.json', MediaType.Json],
  ['.pdf', MediaType.Pdf],
  ['.png', MediaType.Png],
  ['.jpg', MediaType.Jpeg],
  ['.jpeg', MediaType.Jpeg],
  ['.gif', MediaType.Gif],
  ['.webp', MediaType.Webp],
  ['.svg', MediaType.Svg],
  ['.mp4', MediaType.Mp4],
  ['.zip', MediaType.Zip],
  ['.html', MediaType.HtmlDocument],
  ['.htm', MediaType.HtmlDocument],
  ['.csv', MediaType.Csv],
  ['.md', MediaType.Markdown],
  ['.xml', MediaType.Xml],
]);

const MIME_EXTENSIONS: ReadonlyMap<string, string> = new Map([
  [MediaType.PlainText, '.txt'],
  [MediaType.Json, '.json'],
  [MediaType.Pdf, '.pdf'],
  [MediaType.Png, '.png'],
  [MediaType.Jpeg, '.jpg'],
  [MediaType.Gif, '.gif'],
  [MediaType.Webp, '.webp'],
  [MediaType.Svg, '.svg'],
  [MediaType.Mp4, '.mp4'],
  [MediaType.Zip, '.zip'],
  [MediaType.HtmlDocument, '.html'],
  [MediaType.Csv, '.csv'],
  [MediaType.Markdown, '.md'],
  [MediaType.Xml, '.xml'],
]);

type ParsedUpload = {
  readonly filename: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly expiresAt: string | null;
};

type DownloadSource = {
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly r2Key: string | null;
  readonly content: Uint8Array | null;
  readonly workspaceFiles: R2Bucket | undefined;
};

function stripControlChars(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;

      return code >= ASCII_SPACE && code !== ASCII_DELETE;
    })
    .join('');
}

function finalPathComponent(rawName: string): string {
  const parts = rawName.split(/[/\\]/u);
  const candidate = stripControlChars(parts.at(-1) ?? '').trim();

  if (DOT_NAMES.has(candidate)) {
    return '';
  }

  return candidate;
}

function inferMimeType(rawType: string, filename: string): string {
  const normalized = (rawType.split(';')[0] ?? '').trim().toLowerCase();

  if (normalized.length > 0) {
    if (normalized.length > MIME_TYPE_MAX_CHARS) {
      throw new ManagedHttpError(HttpStatusCode.BadRequest, 'File MIME type exceeds maximum length');
    }

    return normalized;
  }

  const dot = filename.lastIndexOf('.');

  if (dot > 0) {
    const inferred = EXTENSION_MIME_TYPES.get(filename.slice(dot).toLowerCase());

    if (inferred !== undefined) {
      return inferred;
    }
  }

  return MediaType.OctetStream;
}

function normalizeFilename(rawName: string, mimeType: string): string {
  const base = finalPathComponent(rawName);
  let filename = base;

  if (filename.length === 0) {
    filename = `unnamed${MIME_EXTENSIONS.get(mimeType) ?? ''}`;
  }

  if (filename.length > FILENAME_MAX_CHARS) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'File name must be at most 500 characters');
  }

  return filename;
}

function parseExpiresInSeconds(raw: string): string {
  if (!/^\d+$/u.test(raw)) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'expires_in_seconds must be an integer');
  }

  const seconds = Number(raw);

  if (!Number.isSafeInteger(seconds) || seconds < EXPIRES_MIN_SECONDS || seconds > EXPIRES_MAX_SECONDS) {
    throw new ManagedHttpError(
      HttpStatusCode.BadRequest,
      'expires_in_seconds must be between 3600 and 7776000 seconds',
    );
  }

  return new Date(Date.now() + seconds * MILLISECONDS_PER_SECOND).toISOString();
}

function optionalExpiresAt(raw: string | undefined): string | null {
  if (raw === undefined) {
    return null;
  }

  return parseExpiresInSeconds(raw);
}

async function parseFileUpload(request: Request): Promise<ParsedUpload> {
  const form = await readBoundedMultipartForm({
    request,
    maxBytes: FILE_UPLOAD_MAX_BYTES,
    missingMessage: 'Upload files as multipart/form-data',
    oversizedMessage: 'File upload exceeds the allowed size',
    malformedMessage: 'Malformed or oversized multipart file upload',
  });

  const parts: Array<File> = [];
  const expirations: Array<string> = [];

  for (const [key, value] of form.entries()) {
    if (key === 'file' && typeof value !== 'string' && parts.length === 0) {
      parts.push(value);
    } else if (key === 'expires_in_seconds' && typeof value === 'string' && expirations.length === 0) {
      expirations.push(value);
    } else {
      throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Unexpected multipart field in file upload');
    }
  }

  const [part] = parts;

  if (part === undefined) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'A file multipart field is required');
  }

  const bytes = new Uint8Array(await part.arrayBuffer());

  if (bytes.byteLength > FILE_UPLOAD_MAX_BYTES) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'File upload exceeds the allowed size');
  }

  const rawComponent = finalPathComponent(part.name);
  const mimeType = inferMimeType(part.type, rawComponent);
  const filename = normalizeFilename(part.name, mimeType);
  const [rawExpiry] = expirations;
  const expiresAt = optionalExpiresAt(rawExpiry);

  return { filename, mimeType, bytes, expiresAt };
}

function pathParam(params: Readonly<Record<string, string>>, key: string): string {
  const value = params[key];

  if (value === undefined || value.length === 0) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, `Missing file path parameter ${key}`);
  }

  return value;
}

function safeDispositionFilename(filename: string): string {
  return stripControlChars(filename).replaceAll(/["\\]/gu, '_');
}

async function removeBucketObject(bucket: R2Bucket | undefined, r2Key: string | null): Promise<void> {
  if (bucket === undefined || r2Key === null) {
    return;
  }

  const objects = bucket;

  await objects.delete(r2Key).catch(() => undefined);
}

async function downloadResponse({
  filename,
  mimeType,
  sizeBytes,
  r2Key,
  content,
  workspaceFiles,
}: DownloadSource): Promise<Response> {
  const headers = {
    [HttpHeader.ContentType]: mimeType,
    [HttpHeader.ContentLength]: String(sizeBytes),
    [HttpHeader.ContentDisposition]: `attachment; filename="${safeDispositionFilename(filename)}"`,
    [HttpHeader.XContentTypeOptions]: 'nosniff',
  };

  if (r2Key !== null) {
    if (workspaceFiles === undefined) {
      throw new ManagedHttpError(HttpStatusCode.Unavailable, 'Workspace object storage is not configured');
    }

    const object = await workspaceFiles.get(r2Key);

    if (object === null) {
      throw new ManagedHttpError(HttpStatusCode.NotFound, 'File content is missing');
    }

    return new Response(object.body, { status: HttpStatusCode.Ok, headers });
  }

  if (content === null) {
    throw new ManagedHttpError(HttpStatusCode.NotFound, 'File content is missing');
  }

  return new Response(new Uint8Array(content), { status: HttpStatusCode.Ok, headers });
}

function buildListOptions(query: ManagedRequest['query'], scope: ManagedRequest['scope']) {
  const paging = managedPageQuery(query);

  const options: {
    readonly scope: ManagedRequest['scope'];
    page?: string;
    maxRows?: number;
    ids?: ReadonlyArray<string>;
    scopeId?: string;
  } = { scope };

  if (paging.page !== undefined) {
    options.page = paging.page;
  }

  if (paging.maxRows !== undefined) {
    options.maxRows = paging.maxRows;
  }

  if (query['ids[]'] !== undefined) {
    options.ids = Schema.decodeUnknownSync(Schema.Array(Schema.String))(query['ids[]']);
  }

  if (typeof query['scope_id'] === 'string') {
    options.scopeId = query['scope_id'];
  }

  return options;
}

export async function handleFiles({
  operation,
  params,
  query,
  request,
  scope,
  store,
  workspaceFiles,
  workerSession,
}: ManagedRequest): Promise<unknown> {
  const files = store.managed.files;

  if (workerSession !== undefined) {
    const fileId = pathParam(params, 'file_id');
    const includeContent = operation === 'beta_download_file_v1_files__file_id__content_get';

    if (!includeContent && operation !== 'beta_get_file_metadata_v1_files__file_id__get') {
      throw new ManagedStoreError(HttpStatusCode.Forbidden, 'Worker access is limited to mounted session files');
    }

    const { record, r2Key, content } = await files.sessionFile({ ...workerSession, fileId, includeContent });

    if (includeContent) {
      return await downloadResponse({
        filename: record.filename,
        mimeType: record.mime_type,
        sizeBytes: record.size_bytes,
        r2Key,
        content,
        workspaceFiles,
      });
    }

    return record;
  }

  switch (operation) {
    case 'beta_upload_file_v1_files_post':
    case 'upload_file_v1_files_post': {
      const uploaded = await parseFileUpload(request);
      const sha256 = await sha256Hex(uploaded.bytes);
      const fileId = `file_${crypto.randomUUID().replaceAll('-', '')}`;

      if (workspaceFiles !== undefined) {
        const r2Key = `managed-files/${scope.workspaceId}/${fileId}`;

        await workspaceFiles.put(r2Key, uploaded.bytes, { httpMetadata: { contentType: uploaded.mimeType } });

        try {
          return await files.create({
            scope,
            id: fileId,
            filename: uploaded.filename,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.bytes.byteLength,
            sha256,
            r2Key,
            content: null,
            expiresAt: uploaded.expiresAt,
          });
        } catch (error) {
          await removeBucketObject(workspaceFiles, r2Key);

          throw error;
        }
      }

      return await files.create({
        scope,
        id: fileId,
        filename: uploaded.filename,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.bytes.byteLength,
        sha256,
        r2Key: null,
        content: uploaded.bytes,
        expiresAt: uploaded.expiresAt,
      });
    }
    case 'beta_list_files_v1_files_get':
    case 'list_files_v1_files_get':
      return await files.list(buildListOptions(query, scope));
    case 'beta_get_file_metadata_v1_files__file_id__get':
    case 'get_file_metadata_v1_files__file_id__get':
      return await files.get({ scope, fileId: pathParam(params, 'file_id') });
    case 'beta_download_file_v1_files__file_id__content_get':
    case 'download_file_v1_files__file_id__content_get': {
      const stored = await files.content({ scope, fileId: pathParam(params, 'file_id') });

      return await downloadResponse({ ...stored, workspaceFiles });
    }
    case 'beta_delete_file_v1_files__file_id__delete':
    case 'delete_file_v1_files__file_id__delete': {
      const deleted = await files.delete({ scope, fileId: pathParam(params, 'file_id') });

      await removeBucketObject(workspaceFiles, deleted.r2Key);

      return { id: deleted.id, type: deleted.type };
    }
    default:
      throw new ManagedHttpError(HttpStatusCode.NotFound, 'Unknown files operation');
  }
}
