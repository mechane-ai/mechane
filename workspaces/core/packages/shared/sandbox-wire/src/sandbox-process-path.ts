import type { SandboxProcessIdentity } from './interactive-service.ts';
import { SANDBOX_SERVICE_PREFIX } from './service.ts';

/** Submission and receipt lookup address the original process identity. */
export function sandboxProcessPath({ workspaceId, mechId, processId }: SandboxProcessIdentity): string {
  const workspaceSegment = encodeURIComponent(workspaceId);
  const mechSegment = encodeURIComponent(mechId);
  const processSegment = encodeURIComponent(processId);

  return `${SANDBOX_SERVICE_PREFIX}/${workspaceSegment}/${mechSegment}/processes/${processSegment}`;
}
