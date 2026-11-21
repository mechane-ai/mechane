import type { ControlStore } from '@mechane/control-store';
import {
  BYTES_PER_MEBIBYTE,
  EvidenceArtifactId,
  HttpHeader,
  HttpMethod,
  HttpStatusCode,
  MediaType,
  SHA256_PATTERN,
} from '@mechane/records';
import { SANDBOX_EVIDENCE_HEADERS, SandboxEvidenceKind, SandboxEvidenceMetadata } from '@mechane/sandbox-provider';
import { Schema } from 'effect';
import { ManagedHttpError } from './http-error.ts';
import { sha256Hex } from './upload.ts';
import { requireWorkerWorkspace, workerBearer } from './work-auth.ts';

const EVIDENCE_UPLOAD_PATH = /^\/internal\/managed\/sessions\/(sesn_[A-Za-z0-9_-]{1,128})\/evidence\/([^/]+)$/u;
const EVIDENCE_MAX_MEBIBYTES = 100;
const EVIDENCE_MAX_BYTES = EVIDENCE_MAX_MEBIBYTES * BYTES_PER_MEBIBYTE;
const ALLOWED_MEDIA_TYPES: ReadonlySet<string> = new Set([MediaType.Png, MediaType.Jpeg, MediaType.Mp4]);

type UploadRoute = { readonly sessionId: string; readonly artifactId: string };

type UploadInput = {
  readonly route: UploadRoute;
  readonly request: Request;
  readonly store: ControlStore;
  readonly workspaceFiles: R2Bucket | undefined;
};

export function matchDirectEvidenceUpload(path: string): UploadRoute | null {
  const [, sessionId, artifactId] = EVIDENCE_UPLOAD_PATH.exec(path) ?? [];

  if (sessionId === undefined || artifactId === undefined || !Schema.is(EvidenceArtifactId)(artifactId)) {
    return null;
  }

  return { sessionId, artifactId };
}

function optionalHeaderInteger(headers: Headers, name: string): number | null {
  const raw = headers.get(name);

  if (raw === null || raw.length === 0) {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, `Invalid integer header ${name}`);
  }

  return parsed;
}

/** Handles direct worker-to-R2 screenshot and recording uploads without a Cloudflare SandboxObject hop. */
export async function handleDirectEvidenceUpload({
  route,
  request,
  store,
  workspaceFiles,
}: UploadInput): Promise<Response> {
  if (request.method !== HttpMethod.Put) {
    throw new ManagedHttpError(HttpStatusCode.MethodNotAllowed, 'Use PUT to upload session evidence');
  }

  if (workspaceFiles === undefined) {
    throw new ManagedHttpError(HttpStatusCode.Unavailable, 'Workspace object storage is not configured');
  }

  const token = workerBearer(request);

  if (!token.startsWith('sk-ant-req-')) {
    throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'An installed work credential is required');
  }

  const grant = await store.managed.worker.allocations.authorizeComputer({
    token,
    sessionId: route.sessionId,
    access: 'tool',
  });

  if (grant === null) {
    throw new ManagedHttpError(HttpStatusCode.Forbidden, 'The worker lease does not allow uploading session evidence');
  }

  requireWorkerWorkspace(request, grant.workspaceId);

  const mediaType = request.headers.get(HttpHeader.ContentType)?.split(';')[0]?.trim() ?? '';

  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Unsupported evidence media type');
  }

  const rawKind = request.headers.get(SANDBOX_EVIDENCE_HEADERS.kind);
  const decodedKind = Schema.decodeUnknownResult(SandboxEvidenceKind)(rawKind);

  if (decodedKind._tag === 'Failure') {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Invalid evidence kind header');
  }

  const expectedSha256 = request.headers.get(SANDBOX_EVIDENCE_HEADERS.sha256)?.trim().toLowerCase() ?? '';

  if (!SHA256_PATTERN.test(expectedSha256)) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Missing or invalid evidence SHA-256 header');
  }

  const bytes = new Uint8Array(await request.arrayBuffer());

  if (bytes.byteLength === 0 || bytes.byteLength > EVIDENCE_MAX_BYTES) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Evidence artifact size is out of bounds');
  }

  const actualSha256 = await sha256Hex(bytes);

  if (actualSha256 !== expectedSha256) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Evidence SHA-256 digest mismatch');
  }

  const r2Key = `managed-evidence/${grant.workspaceId}/${route.sessionId}/${route.artifactId}`;

  await workspaceFiles.put(r2Key, bytes, { httpMetadata: { contentType: mediaType } });

  const stored = await store.managed.evidence.put({
    id: route.artifactId,
    workspaceId: grant.workspaceId,
    sessionId: route.sessionId,
    turnId: request.headers.get(SANDBOX_EVIDENCE_HEADERS.turnId),
    kind: decodedKind.success,
    mediaType,
    sizeBytes: bytes.byteLength,
    sha256: actualSha256,
    r2Key,
    width: optionalHeaderInteger(request.headers, SANDBOX_EVIDENCE_HEADERS.width),
    height: optionalHeaderInteger(request.headers, SANDBOX_EVIDENCE_HEADERS.height),
    durationMs: optionalHeaderInteger(request.headers, SANDBOX_EVIDENCE_HEADERS.durationMs),
  });

  const payload = Schema.encodeSync(SandboxEvidenceMetadata)(stored);

  return Response.json(payload, {
    status: HttpStatusCode.Ok,
    headers: { [HttpHeader.CacheControl]: 'private, no-store', [HttpHeader.XContentTypeOptions]: 'nosniff' },
  });
}
