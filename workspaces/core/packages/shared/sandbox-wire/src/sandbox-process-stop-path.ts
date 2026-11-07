import type { SandboxProcessIdentity } from './interactive-service.ts';
import { SANDBOX_SERVICE_PREFIX } from './service.ts';

/** Stop addresses one original process handle without allocating an environment. */
export function sandboxProcessStopPath({ workspaceId, mechId, processId }: SandboxProcessIdentity): string {
  const workspaceSegment = encodeURIComponent(workspaceId);
  const mechSegment = encodeURIComponent(mechId);
  const processSegment = encodeURIComponent(processId);

  return `${SANDBOX_SERVICE_PREFIX}/${workspaceSegment}/${mechSegment}/processes/${processSegment}/stop`;
}
