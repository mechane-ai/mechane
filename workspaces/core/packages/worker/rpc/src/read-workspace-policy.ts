import { WorkspacePolicy } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { directoryStub } from './stubs/directory-stub.ts';
import { workspaceStub } from './stubs/workspace-stub.ts';
import type { ObjectBindings } from './types.ts';

type ReadWorkspacePolicyInput = { readonly bindings: ObjectBindings; readonly workspaceId: typeof WorkspaceId.Encoded };

/** The directory's stored allowance remains the default until the operator sets a workspace policy. */
export async function readWorkspacePolicy({
  bindings,
  workspaceId,
}: ReadWorkspacePolicyInput): Promise<WorkspacePolicy> {
  const directory = directoryStub({ bindings });
  const initialAllowanceMicros = await directory.dailyAllowanceMicros({ workspaceId });
  const workspace = workspaceStub({ bindings, workspaceId });
  const answer = await workspace.policy({ initialAllowanceMicros });

  return await Schema.decodeUnknownPromise(WorkspacePolicy)(answer);
}
