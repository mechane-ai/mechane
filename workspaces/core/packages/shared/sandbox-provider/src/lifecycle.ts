import type { SandboxSnapshot } from './schemas.ts';
import type { SandboxIdentifierInput, SandboxLeaseSpecification } from './types.ts';

export function sandboxWorkerEnvironment(specification: SandboxLeaseSpecification): Readonly<Record<string, string>> {
  return {
    ...specification.environment,
    MECHANE_WORKSPACE_ID: specification.workspaceId,
    MECHANE_ENVIRONMENT_ID: specification.environmentId,
    MECHANE_SESSION_ID: specification.sessionId,
    MECHANE_ALLOCATION_GENERATION: String(specification.generation),
    MECHANE_WORK_ID: specification.workId,
    MECHANE_WORK_SECRET: specification.workSecret,
    MECHANE_API_ORIGIN: specification.apiOrigin,
  };
}

export async function captureOptionalSnapshot({
  sandboxId,
  shouldSnapshot,
  snapshot,
}: {
  readonly sandboxId: string;
  readonly shouldSnapshot: boolean;
  readonly snapshot: (input: SandboxIdentifierInput) => Promise<SandboxSnapshot>;
}): Promise<string | null> {
  if (!shouldSnapshot) {
    return null;
  }

  const captured = await snapshot({ sandboxId });

  return captured.snapshotId;
}
