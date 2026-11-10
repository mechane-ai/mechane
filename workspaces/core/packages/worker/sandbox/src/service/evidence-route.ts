import { EvidenceQuery, RequestInvalid, sandboxEvidenceContentPath } from '@mechane/protocol';
import { EvidenceArtifactId, HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import type { SandboxServiceIdentity } from '@mechane/sandbox-wire';
import { Record, Schema } from 'effect';
import type { SandboxObject } from '../sandbox-object.ts';

type EvidenceRouteInput = {
  readonly request: Request;
  readonly stub: DurableObjectStub<SandboxObject>;
  readonly url: URL;
  readonly owner: SandboxServiceIdentity;
  /** Undefined selects the receipt collection. */
  readonly artifactId: string | undefined;
  /** Undefined selects metadata; content selects the private media body. */
  readonly action: string | undefined;
};

/** Service authentication precedes this route; the application separately admits public metadata and media reads. */
export async function serveEvidence({
  request,
  stub,
  url,
  owner,
  artifactId,
  action,
}: EvidenceRouteInput): Promise<Response> {
  if (request.method === HttpMethod.Post && artifactId !== undefined && action === 'export') {
    const decoded = decodeURIComponent(artifactId);
    const identity = Schema.decodeUnknownSync(EvidenceArtifactId)(decoded);
    const result = await stub.exportEvidence({ artifactId: identity });

    return Response.json(result);
  }

  if (request.method !== HttpMethod.Get) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  if (artifactId === undefined) {
    if (action !== undefined) {
      return new Response(null, { status: HttpStatusCode.NotFound });
    }

    const fields = Record.fromEntries(url.searchParams);
    const query = Schema.decodeUnknownSync(EvidenceQuery, { onExcessProperty: 'error' })(fields);
    const encoded = Schema.encodeSync(EvidenceQuery)(query);
    const page = await stub.listEvidence(encoded);

    if (page === null) {
      return new Response(null, { status: HttpStatusCode.NotFound });
    }

    if ('_tag' in page) {
      const failure = Schema.decodeUnknownSync(RequestInvalid)(page);
      const body = Schema.encodeSync(RequestInvalid)(failure);

      return Response.json(body, { status: HttpStatusCode.BadRequest });
    }

    return Response.json(page);
  }

  const decoded = decodeURIComponent(artifactId);
  const identity = Schema.decodeUnknownSync(EvidenceArtifactId)(decoded);

  if (action === 'content') {
    const rangeHeader = request.headers.get(HttpHeader.Range);
    const path = sandboxEvidenceContentPath({ ...owner, artifactId: identity });
    const target = new URL(path, url);
    const headers = new Headers();

    if (rangeHeader !== null) {
      headers.set(HttpHeader.Range, rangeHeader);
    }

    return await stub.fetch(target.href, { method: HttpMethod.Get, headers });
  }

  if (action !== undefined) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  const artifact = await stub.showEvidence({ artifactId: identity });

  if (artifact === null) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  return Response.json(artifact);
}
