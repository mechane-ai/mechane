import { EvidencePath, sandboxEvidenceContentPath } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import type { SandboxStore } from '@mechane/sandbox-store';
import { SANDBOX_SERVICE_PREFIX } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { readEvidenceContent } from '../evidence/evidence-content.ts';

const EvidenceContentIdentity = Schema.Struct(EvidencePath.to.fields);

type ContentInput = { readonly request: Request; readonly store: SandboxStore; readonly bucket: R2Bucket };

/** Only scoped media uses the platform fetch boundary; the body owner checks the bound namespace before R2. */
export async function serveEvidenceContent({ request, store, bucket }: ContentInput): Promise<Response> {
  if (request.method !== HttpMethod.Get) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  const url = new URL(request.url);
  const relative = url.pathname.slice(SANDBOX_SERVICE_PREFIX.length + 1);
  const segments = relative.split('/');
  const [workspaceId, mechId, , artifactId] = segments;
  const decoded = Schema.decodeUnknownResult(EvidenceContentIdentity)({ workspaceId, mechId, artifactId });

  if (Result.isFailure(decoded)) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  const path = sandboxEvidenceContentPath(decoded.success);

  if (url.pathname !== path) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  const range = request.headers.get(HttpHeader.Range);
  const rangeHeader = Option.fromNullishOr(range);

  return await readEvidenceContent({ store, bucket, ...decoded.success, rangeHeader });
}
