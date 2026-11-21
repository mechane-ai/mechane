import type { ManagedHttpRoute } from '@mechane/managed-protocol';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { Option } from 'effect';
import { readJsonBody, readTextBody } from '../http/body.ts';
import { ManagedHttpError } from './http-error.ts';
import { decodeManagedBody } from './request-input.ts';

const EXECUTION_REQUEST_MAX_BYTES = 33_554_432;
const MANAGED_BETA = 'managed-agents-2026-04-01';
const MEMORY_BETA = 'agent-memory-2026-07-22';
const SKILLS_BETA = 'skills-2025-10-02';
const FILES_BETA = 'files-api-2025-04-14';
const supportedVersions: ReadonlySet<string> = new Set(['2026-10-21', '2023-06-01']);

export function requireManagedHeaders(request: Request, path: string): void {
  const version = request.headers.get(HttpHeader.AnthropicVersion) ?? '';

  if (!supportedVersions.has(version)) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'An unsupported or missing anthropic-version was supplied');
  }

  const betas = (request.headers.get(HttpHeader.AnthropicBeta) ?? '')
    .split(',')
    .map((beta) => beta.trim())
    .filter(Boolean);

  if (path.startsWith('/v1/files')) {
    if (betas.length === 0 || betas.includes(FILES_BETA) || betas.includes(MANAGED_BETA)) {
      return;
    }

    throw new ManagedHttpError(
      HttpStatusCode.BadRequest,
      'This endpoint requires no beta or the files-api-2025-04-14 or managed-agents-2026-04-01 beta',
    );
  }

  if (path.startsWith('/v1/skills')) {
    if (betas.length === 0 || betas.includes(SKILLS_BETA) || betas.includes(MANAGED_BETA)) {
      return;
    }

    throw new ManagedHttpError(
      HttpStatusCode.BadRequest,
      'This endpoint requires no beta or the skills-2025-10-02 or managed-agents-2026-04-01 beta',
    );
  }

  if (path.startsWith('/v1/memory_stores') && (betas.includes(MEMORY_BETA) || betas.includes(MANAGED_BETA))) {
    return;
  }

  if (!betas.includes(MANAGED_BETA)) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'This endpoint requires the managed-agents-2026-04-01 beta');
  }
}

export async function managedBody(route: ManagedHttpRoute, request: Request) {
  if (route.isMultipart || request.body === null) {
    return decodeManagedBody({ route, raw: {} });
  }

  if (Option.isNone(route.body)) {
    const text = await readTextBody(request);

    if (text.length === 0) {
      return {};
    }

    let raw: unknown = {};

    try {
      raw = JSON.parse(text);
    } catch {
      throw new ManagedHttpError(HttpStatusCode.BadRequest, 'This operation takes no body');
    }

    return decodeManagedBody({ route, raw });
  }

  const [mediaType] = (request.headers.get(HttpHeader.ContentType) ?? '').split(';');

  if ((mediaType ?? '').trim().toLowerCase() !== MediaType.Json) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Expected application/json');
  }

  if (/^\/v1\/(?:sessions|agents|environments)(?:\/|$)/u.test(route.path)) {
    return decodeManagedBody({ route, raw: await readJsonBody(request, EXECUTION_REQUEST_MAX_BYTES) });
  }

  return decodeManagedBody({ route, raw: await readJsonBody(request) });
}

export function managedResponse(value: unknown, requestId: string): Response {
  if (!(value instanceof Response)) {
    return Response.json(value, {
      headers: { [HttpHeader.RequestId]: requestId, [HttpHeader.CacheControl]: 'no-store' },
    });
  }

  const headers = new Headers(value.headers);

  headers.set(HttpHeader.RequestId, requestId);
  headers.set(HttpHeader.CacheControl, 'no-store');

  return new Response(value.body, { headers, status: value.status });
}
