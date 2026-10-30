import { callDirectory } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { WorkspaceNotFound } from '@mechane/protocol';
import type { InstallationAdministratorRequired, ObjectUnavailable } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { WorkspacePresence } from '@mechane/rpc';
import { Effect } from 'effect';
import { requireInstallationAdministrator } from '../../../admission/require-installation-administrator.ts';
import type { Caller } from '../../../types.ts';

type RequireManagedWorkspaceInput = {
  readonly settings: WorkerSettings;
  readonly caller: Caller;
  readonly workspaceId: typeof WorkspaceId.Encoded;
};

/** Operator policy administration stays available while ordinary workspace access is suspended. */
export const requireManagedWorkspace = Effect.fn('requireManagedWorkspace')(function* ({
  settings,
  caller,
  workspaceId,
}: RequireManagedWorkspaceInput): Effect.fn.Return<
  void,
  InstallationAdministratorRequired | ObjectUnavailable | WorkspaceNotFound
> {
  yield* requireInstallationAdministrator({ settings, caller });

  const { isPresent } = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.workspaceExists({ workspaceId }),
    answer: WorkspacePresence,
  });

  if (!isPresent) {
    const id = WorkspaceId.make(workspaceId);

    return yield* new WorkspaceNotFound({ workspaceId: id });
  }
});
