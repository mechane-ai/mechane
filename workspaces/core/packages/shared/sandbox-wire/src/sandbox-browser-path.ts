import type { SandboxBrowserIdentity } from './interactive-service.ts';
import { SANDBOX_SERVICE_PREFIX } from './service.ts';

/** Browser submission and read-only receipt lookup share the immutable request address. */
export function sandboxBrowserPath({ workspaceId, mechId, requestId }: SandboxBrowserIdentity): string {
  const workspaceSegment = encodeURIComponent(workspaceId);
  const mechSegment = encodeURIComponent(mechId);
  const requestSegment = encodeURIComponent(requestId);

  return `${SANDBOX_SERVICE_PREFIX}/${workspaceSegment}/${mechSegment}/browser/${requestSegment}`;
}
