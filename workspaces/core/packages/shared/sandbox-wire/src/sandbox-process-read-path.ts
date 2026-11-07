import { Schema } from 'effect';
import type { SandboxProcessIdentity } from './interactive-service.ts';
import { ProcessObservationQuery } from './process-observation-query.ts';
import { SANDBOX_SERVICE_PREFIX } from './service.ts';

type ProcessReadPathInput = SandboxProcessIdentity & { readonly shouldTouch: boolean };

/** Exact-handle reads carry their activity policy in the operation's encoded query. */
export function sandboxProcessReadPath({ workspaceId, mechId, processId, shouldTouch }: ProcessReadPathInput): string {
  const workspaceSegment = encodeURIComponent(workspaceId);
  const mechSegment = encodeURIComponent(mechId);
  const processSegment = encodeURIComponent(processId);
  const fields = Schema.encodeSync(ProcessObservationQuery)({ touch: shouldTouch });
  const query = new URLSearchParams(fields);

  return `${SANDBOX_SERVICE_PREFIX}/${workspaceSegment}/${mechSegment}/processes/${processSegment}/read?${query.toString()}`;
}
