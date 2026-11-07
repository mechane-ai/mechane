import { Schema } from 'effect';
import { ProcessObservationQuery } from './process-observation-query.ts';
import { SANDBOX_SERVICE_PREFIX } from './service.ts';
import type { SandboxServiceIdentity } from './service.ts';

type ProcessListPathInput = SandboxServiceIdentity & { readonly shouldTouch: boolean };

/** Passive list requests leave the existing environment's idle deadline unchanged. */
export function sandboxProcessesPath({ workspaceId, mechId, shouldTouch }: ProcessListPathInput): string {
  const workspaceSegment = encodeURIComponent(workspaceId);
  const mechSegment = encodeURIComponent(mechId);
  const fields = Schema.encodeSync(ProcessObservationQuery)({ touch: shouldTouch });
  const query = new URLSearchParams(fields);

  return `${SANDBOX_SERVICE_PREFIX}/${workspaceSegment}/${mechSegment}/processes?${query.toString()}`;
}
