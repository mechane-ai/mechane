import type { DirectoryStore, ManagedWorkspaceRow } from '@mechane/directory-store';
import { WorkspaceId } from '@mechane/records';
import { Option, Result, Schema } from 'effect';

/** A live membership or a committed creation must identify an existing workspace. */
class DirectoryWorkspaceMissing extends Schema.TaggedError<DirectoryWorkspaceMissing>()('DirectoryWorkspaceMissing', {
  workspaceId: WorkspaceId,
}) {}

type RequiredWorkspaceInput = { readonly store: DirectoryStore; readonly workspaceId: typeof WorkspaceId.Encoded };

/** Missing storage after an owned write or live membership is a broken directory invariant. */
export function requiredWorkspace({ store, workspaceId }: RequiredWorkspaceInput): ManagedWorkspaceRow {
  const workspace = store.managedWorkspace({ workspaceId });

  if (Option.isNone(workspace)) {
    const id = WorkspaceId.make(workspaceId);

    const error = new DirectoryWorkspaceMissing({ workspaceId: id });
    const missing = Result.fail(error);

    return Result.getOrThrow(missing);
  }

  return workspace.value;
}
