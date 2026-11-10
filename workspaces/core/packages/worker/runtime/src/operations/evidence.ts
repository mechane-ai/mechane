import type { ControlStore } from '@mechane/control-store';
import {
  catalog,
  EvidenceArtifact,
  EvidenceMediaType,
  EvidenceNotFound,
  EvidencePage,
  EvidenceUnavailable,
  MechNotFound,
  RequestInvalid,
  sandboxEvidenceArtifactPath,
  sandboxEvidenceContentPath,
  sandboxEvidenceListPath,
  ServiceUnavailable,
} from '@mechane/protocol';
import type { EvidencePath } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { SandboxServiceIdentity } from '@mechane/sandbox-wire';
import { Redacted, Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import { TOOL_REQUEST_TIMEOUT_MS } from '../tools/constants.ts';
import { readBoundedJson, rejectRedirect } from '../tools/http.ts';
import { requireWorkspaceMember } from './auth/admission.ts';
import type { AuthCaller } from './types.ts';
import { validatedOperation } from './validated-operation.ts';

type EvidenceOperationsInput = { readonly store: ControlStore; readonly configuration: RuntimeConfiguration };

type EvidenceAdmission = {
  readonly store: ControlStore;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly caller: AuthCaller;
};

type ServiceRequest = {
  readonly configuration: RuntimeConfiguration;
  readonly path: string;
  /** Absent requests complete media; ordinary metadata requests never send this header. */
  readonly mediaRange?: string;
};

async function authorizeEvidence({ store, workspaceId, mechId, caller }: EvidenceAdmission): Promise<void> {
  await requireWorkspaceMember({ store, caller, workspaceId });
  await store.getMech({ workspaceId, mechId });
}

async function requestEvidenceService({ configuration, path, mediaRange }: ServiceRequest): Promise<Response> {
  const url = new URL(path, configuration.sandbox.origin);
  const headers = new Headers({ [HttpHeader.Authorization]: `Bearer ${Redacted.value(configuration.sandbox.bearer)}` });

  if (mediaRange !== undefined) {
    headers.set(HttpHeader.Range, mediaRange);
  }

  try {
    const response = await fetch(url, {
      method: HttpMethod.Get,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS),
    });

    await rejectRedirect(response);

    return response;
  } catch {
    throw new ServiceUnavailable({ reason: 'The evidence service could not be reached' });
  }
}

async function readMetadata(response: Response): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel();

    throw new ServiceUnavailable({ reason: 'The evidence service could not read capture metadata' });
  }

  try {
    return await readBoundedJson(response);
  } catch {
    throw new ServiceUnavailable({ reason: 'The evidence service returned unreadable capture metadata' });
  }
}

const MEDIA_SUCCESS_STATUSES: ReadonlySet<number> = new Set([HttpStatusCode.Ok, HttpStatusCode.PartialContent]);

type ContentResponse = { readonly response: Response; readonly identity: EvidencePath };

async function validatedMediaResponse({ response, identity }: ContentResponse): Promise<Response> {
  if (response.status === HttpStatusCode.NotFound) {
    await response.body?.cancel();

    throw new EvidenceNotFound({ artifactId: identity.artifactId });
  }

  const isMediaStatus = MEDIA_SUCCESS_STATUSES.has(response.status);

  if (!isMediaStatus && response.status !== HttpStatusCode.RangeNotSatisfiable) {
    await response.body?.cancel();

    throw new EvidenceUnavailable({ artifactId: identity.artifactId, reason: 'The stored capture is unavailable' });
  }

  const mediaType = response.headers.get(HttpHeader.ContentType);

  if (!Schema.is(EvidenceMediaType)(mediaType)) {
    await response.body?.cancel();

    throw new EvidenceUnavailable({
      artifactId: identity.artifactId,
      reason: 'The stored capture media type is invalid',
    });
  }

  const headers = new Headers({
    [HttpHeader.ContentType]: mediaType,
    [HttpHeader.CacheControl]: 'private, no-store',
    [HttpHeader.XContentTypeOptions]: 'nosniff',
    [HttpHeader.AcceptRanges]: 'bytes',
  });

  for (const name of [HttpHeader.ContentDisposition, HttpHeader.ContentLength, HttpHeader.ContentRange]) {
    const value = response.headers.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  }

  return new Response(response.body, { status: response.status, headers });
}

/** Every read rechecks current membership and mech ownership before touching private sandbox evidence. */
export function createEvidenceOperations({ store, configuration }: EvidenceOperationsInput) {
  return {
    listEvidence: validatedOperation({
      operation: catalog.listEvidence,
      run: async ({ input, caller }) => {
        await authorizeEvidence({ store, caller, ...input });

        const identity = Schema.decodeUnknownSync(SandboxServiceIdentity)(input);
        const path = sandboxEvidenceListPath({ ...input, ...identity });
        const response = await requestEvidenceService({ configuration, path });

        if (response.status === HttpStatusCode.NotFound) {
          await response.body?.cancel();

          throw new MechNotFound({ mechId: input.mechId });
        }

        if (response.status === HttpStatusCode.BadRequest) {
          const body = await readBoundedJson(response);
          const failure = Schema.decodeUnknownSync(RequestInvalid)(body);

          throw failure;
        }

        const raw = await readMetadata(response);
        const page = Schema.decodeUnknownSync(EvidencePage)(raw);

        return Schema.encodeSync(EvidencePage)(page);
      },
    }),
    showEvidence: validatedOperation({
      operation: catalog.showEvidence,
      run: async ({ input, caller }) => {
        await authorizeEvidence({ store, caller, ...input });

        const path = sandboxEvidenceArtifactPath(input);
        const response = await requestEvidenceService({ configuration, path });

        if (response.status === HttpStatusCode.NotFound) {
          await response.body?.cancel();

          throw new EvidenceNotFound({ artifactId: input.artifactId });
        }

        const raw = await readMetadata(response);
        const artifact = Schema.decodeUnknownSync(EvidenceArtifact)(raw);

        if (artifact.workspaceId !== input.workspaceId || artifact.mechId !== input.mechId) {
          throw new EvidenceNotFound({ artifactId: input.artifactId });
        }

        if (artifact.artifactId !== input.artifactId) {
          throw new EvidenceNotFound({ artifactId: input.artifactId });
        }

        return Schema.encodeSync(EvidenceArtifact)(artifact);
      },
    }),
    readEvidenceContent: validatedOperation({
      operation: catalog.readEvidenceContent,
      run: async ({ input, caller, mediaRange }) => {
        await authorizeEvidence({ store, caller, ...input });

        const path = sandboxEvidenceContentPath(input);
        const request = { configuration, path };
        const mediaRequest = withOptionalRange({ request, mediaRange });
        const response = await requestEvidenceService(mediaRequest);

        return await validatedMediaResponse({ response, identity: input });
      },
    }),
  };
}

type OptionalRangeInput = {
  readonly request: ServiceRequest;
  /** Undefined requests the complete capture. */
  readonly mediaRange: string | undefined;
};

function withOptionalRange({ request, mediaRange }: OptionalRangeInput): ServiceRequest {
  if (mediaRange === undefined) {
    return request;
  }

  return { ...request, mediaRange };
}
