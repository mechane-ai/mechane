import { RequestInvalid } from '@mechane/protocol';
import type { EvidenceArtifact, EvidencePage, EvidencePath, EvidenceQuery } from '@mechane/protocol';
import type { SandboxStore } from '@mechane/sandbox-store';
import type { SandboxOwner } from '@mechane/sandbox-wire';
import { Option, Result } from 'effect';

type OwnerInput = SandboxOwner & { readonly store: SandboxStore };
type ArtifactInput = EvidencePath & { readonly store: SandboxStore };

/** Resolves only this sandbox's evidence without revealing whether another owner's artifact exists. */
export function readEvidenceArtifact({
  store,
  workspaceId,
  mechId,
  artifactId,
}: ArtifactInput): Option.Option<EvidenceArtifact> {
  const isOwnerMatching = matchesEvidenceOwner({ store, workspaceId, mechId });

  if (!isOwnerMatching) {
    return Option.none();
  }

  const found = store.evidenceArtifact({ artifactId });

  return Option.filter(found, (artifact) => artifact.workspaceId === workspaceId && artifact.mechId === mechId);
}

/** Receipt pagination rejects cursors outside its scope; absent means the requested owner is not bound here. */
export function listEvidenceArtifacts({
  store,
  workspaceId,
  mechId,
  ...query
}: OwnerInput & EvidenceQuery): Result.Result<Option.Option<EvidencePage>, RequestInvalid> {
  const isOwnerMatching = matchesEvidenceOwner({ store, workspaceId, mechId });

  if (!isOwnerMatching) {
    const page = Option.none<EvidencePage>();

    return Result.succeed(page);
  }

  if (Option.isSome(query.after)) {
    const artifactId = query.after.value;
    const cursor = readEvidenceArtifact({ store, workspaceId, mechId, artifactId });
    const isCursorMatching = matchesEvidenceCursor({ cursor, turnId: query.turnId });

    if (!isCursorMatching) {
      const failure = new RequestInvalid({ reason: 'evidence cursor is outside the requested page scope' });

      return Result.fail(failure);
    }
  }

  const page = store.evidenceArtifacts(query);
  const found = Option.some(page);

  return Result.succeed(found);
}

type CursorInput = Pick<EvidenceQuery, 'turnId'> & { readonly cursor: Option.Option<EvidenceArtifact> };

function matchesEvidenceCursor({ cursor, turnId }: CursorInput): boolean {
  if (Option.isNone(cursor)) {
    return false;
  }

  if (Option.isNone(turnId)) {
    return true;
  }

  const selectedRun = turnId.value;

  return Option.exists(cursor.value.turnId, (runId) => runId === selectedRun);
}

function matchesEvidenceOwner({ store, workspaceId, mechId }: OwnerInput): boolean {
  const capacity = store.capacity();

  return Option.exists(capacity, ({ owner }) => owner.workspaceId === workspaceId && owner.mechId === mechId);
}
