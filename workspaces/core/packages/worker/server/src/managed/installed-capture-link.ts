import { consoleSessionEvidenceViewerPath, EvidenceStatus } from '@mechane/protocol';
import { EvidenceArtifactId, HttpHeader } from '@mechane/records';
import { Predicate, Schema } from 'effect';

const Capture = Schema.Struct({ artifact_id: EvidenceArtifactId, status: Schema.Literal(EvidenceStatus.Ready) });
const ReceiptPath = /^(browser|evidence)\/[^/]+$/u;
type Computer = { readonly workspaceId: string; readonly sessionId: string; readonly agentId: string };

type LinkRequest = {
  readonly computer: Computer;
  readonly response: Response;
  readonly publicOrigin: string;
  readonly resource: string;
};

export async function linkInstalledCapture({
  computer,
  response,
  publicOrigin,
  resource,
}: LinkRequest): Promise<Response> {
  const match = ReceiptPath.exec(resource);

  if (!response.ok || match === null) {
    return response;
  }

  const receipt: unknown = await response.json();
  const isBrowser = match[1] === 'browser';
  let linked = receipt;

  if (Predicate.isObject(receipt)) {
    let candidate: unknown = receipt;

    if (isBrowser && 'evidence' in receipt) {
      candidate = receipt['evidence'];
    }

    if (Schema.is(Capture)(candidate)) {
      const path = consoleSessionEvidenceViewerPath({ ...computer, artifactId: candidate.artifact_id });
      const absolute = new URL(path, publicOrigin);
      const capture = { ...candidate, viewer_url: absolute.href };

      linked = capture;

      if (isBrowser) {
        linked = { ...receipt, evidence: capture };
      }
    }
  }

  const headers = new Headers(response.headers);

  headers.delete(HttpHeader.ContentLength);

  return Response.json(linked, { status: response.status, headers });
}
