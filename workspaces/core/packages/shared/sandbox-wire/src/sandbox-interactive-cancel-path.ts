import type { SandboxRunIdentity } from './interactive-service.ts';
import { SANDBOX_SERVICE_PREFIX } from './service.ts';

/** Run cancellation persists its admission fence before stopping its existing interactive work. */
export function sandboxInteractiveCancelPath({ workspaceId, mechId, runId }: SandboxRunIdentity): string {
  const workspaceSegment = encodeURIComponent(workspaceId);
  const mechSegment = encodeURIComponent(mechId);
  const runSegment = encodeURIComponent(runId);

  return `${SANDBOX_SERVICE_PREFIX}/${workspaceSegment}/${mechSegment}/runs/${runSegment}/cancel`;
}
