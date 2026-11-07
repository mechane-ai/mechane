import { Option, Result, Schema } from 'effect';
import { EVIDENCE_OPERATIONS } from './evidence-operations.ts';
import { EvidencePath } from './schemas.ts';

const VIEWER_PATH = /^\/console\/workspaces\/([^/]+)\/mechs\/([^/]+)\/evidence\/([^/]+)\/?$/;

type EvidenceViewerPathInput = { readonly pathname: string };

/** Authenticated media endpoint for an artifact within its owning workspace and mech. */
export function evidenceContentPath({ workspaceId, mechId, artifactId }: EvidencePath): string {
  const encodedWorkspaceId = encodeURIComponent(workspaceId);
  const encodedMechId = encodeURIComponent(mechId);
  const encodedArtifactId = encodeURIComponent(artifactId);
  const workspacePath = EVIDENCE_OPERATIONS.readEvidenceContent.path.replace(':workspace_id', encodedWorkspaceId);
  const mechPath = workspacePath.replace(':mech_id', encodedMechId);

  return mechPath.replace(':artifact_id', encodedArtifactId);
}

/** Stable reviewer URL that preserves resource identity through browser sign-in. */
export function evidenceViewerPath({ workspaceId, mechId, artifactId }: EvidencePath): string {
  return `/console/workspaces/${encodeURIComponent(workspaceId)}/mechs/${encodeURIComponent(mechId)}/evidence/${encodeURIComponent(artifactId)}`;
}

/** Reads resource coordinates from one URL snapshot without waiting for a route-match subscription. */
export function readEvidenceViewerPath({ pathname }: EvidenceViewerPathInput): Option.Option<EvidencePath> {
  const matched = VIEWER_PATH.exec(pathname);
  const match = Option.fromNullishOr(matched);

  if (Option.isNone(match)) {
    return Option.none();
  }

  const [, workspaceId, mechId, artifactId] = match.value;
  const coordinates = { workspaceId, mechId, artifactId };
  const decoded = Schema.decodeUnknownResult(EvidencePath.to, { onExcessProperty: 'error' })(coordinates);

  if (Result.isFailure(decoded)) {
    return Option.none();
  }

  return Option.some(decoded.success);
}
