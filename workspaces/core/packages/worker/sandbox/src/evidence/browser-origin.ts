import { BrowserEvidenceProgress, EvidenceArtifact, EvidencePage } from '@mechane/protocol';
import type { BrowserCall, SandboxStore } from '@mechane/sandbox-store';
import { InstalledActionOrigin } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';

type StoredReceipt = { readonly store: SandboxStore };
type ArtifactInput = StoredReceipt & { readonly artifact: EvidenceArtifact };
type PageInput = StoredReceipt & { readonly page: EvidencePage };
type ActionInput = StoredReceipt & { readonly call: BrowserCall; readonly result: BrowserEvidenceProgress };
type Origin = { readonly origin: typeof InstalledActionOrigin.Encoded };
type CaptureReceipt<Native> = Native extends typeof EvidenceArtifact.Encoded ? Native & Partial<Origin> : Native;
export type ArtifactReceipt = CaptureReceipt<typeof EvidenceArtifact.Encoded>;

export type ArtifactPage = Omit<typeof EvidencePage.Encoded, 'artifacts'> & {
  readonly artifacts: ReadonlyArray<ArtifactReceipt>;
};

export type BrowserReceipt = Pick<typeof BrowserEvidenceProgress.Encoded, 'progress'> &
  Partial<Origin> & { readonly evidence: CaptureReceipt<(typeof BrowserEvidenceProgress.Encoded)['evidence']> };

const encodeOrigin = Schema.encodeSync(InstalledActionOrigin);

type Origins = ReturnType<SandboxStore['captureOrigins']>;
type CaptureInput = Pick<ArtifactInput, 'artifact'> & { readonly origins: Origins };

function captureReceipt({ artifact, origins }: CaptureInput): ArtifactReceipt {
  const encoded = Schema.encodeSync(EvidenceArtifact)(artifact);
  const source = origins.get(artifact.artifactId);
  const origin = Option.fromUndefinedOr(source);

  if (Option.isNone(origin)) {
    return encoded;
  }

  return { ...encoded, origin: encodeOrigin(origin.value) };
}

export function encodeEvidenceReceipt({ store, artifact }: ArtifactInput): ArtifactReceipt {
  const origins = store.captureOrigins({ artifactIds: [artifact.artifactId] });

  return captureReceipt({ artifact, origins });
}

export function encodeEvidencePage({ store, page }: PageInput): ArtifactPage {
  const encoded = Schema.encodeSync(EvidencePage)({ ...page, artifacts: [] });
  const artifactIds = page.artifacts.map(({ artifactId }) => artifactId);
  const origins = store.captureOrigins({ artifactIds });
  const artifacts = page.artifacts.map((artifact) => captureReceipt({ artifact, origins }));

  return { ...encoded, artifacts };
}

/** A stop action can finish a recording captured by a different action in this session. */
export function encodeBrowserReceipt({ store, call, result }: ActionInput): BrowserReceipt {
  const receipt = Schema.encodeSync(BrowserEvidenceProgress)(result);
  const origin = Option.fromNullishOr(call.origin);

  if (Option.isNone(origin)) {
    return receipt;
  }

  const evidence = Option.map(result.evidence, (artifact) => encodeEvidenceReceipt({ store, artifact }));

  return { ...receipt, evidence: Option.getOrNull(evidence), origin: encodeOrigin(origin.value) };
}
