import type { MechId } from './entity.schemas.ts';
import { ToolInvocationId } from './tool-invocation-id.schemas.ts';

type ToolInvocationIdInput = { readonly mechId: typeof MechId.Encoded; readonly nativeTaskId: number };

/** Native task IDs are scoped to their mech and survive tool retries. */
export function toolInvocationId({ mechId, nativeTaskId }: ToolInvocationIdInput): ToolInvocationId {
  const task = String(nativeTaskId);
  const identity = [mechId, task].join(':');

  return ToolInvocationId.make(identity);
}
