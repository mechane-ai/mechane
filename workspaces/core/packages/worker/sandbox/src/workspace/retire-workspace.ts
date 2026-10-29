import type { SandboxStore } from '@mechane/sandbox-store';
import { Option } from 'effect';
import type { WorkspaceFiles } from '../types.ts';
import { workspacePartKey } from './workspace-part-key.ts';

/** The maximum number of retired objects removed during one cleanup step. */
const WORKSPACE_DELETE_PAGE = 100;

type RetireWorkspaceInput = { readonly store: SandboxStore; readonly workspace: WorkspaceFiles };

/** Listing again from the same prefix resumes deletion without a node-local multipart handle or cursor. */
export async function retireWorkspace({ store, workspace }: RetireWorkspaceInput): Promise<boolean> {
  const retired = store.workspace().retired;

  if (Option.isNone(retired)) {
    return true;
  }

  const part = Option.none();
  const prefix = workspacePartKey({ owner: workspace.owner, generation: retired.value, part });
  const bucket = workspace.bucket;
  const page = await bucket.list({ prefix, limit: WORKSPACE_DELETE_PAGE });
  const keys = page.objects.map(({ key }) => key);

  if (keys.length > 0) {
    await bucket.delete(keys);
  }

  if (page.truncated) {
    return false;
  }

  store.clearRetiredWorkspace({ generation: retired.value });

  return true;
}
