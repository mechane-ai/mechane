import { callDirectory } from '@mechane/bindings';
import { writeLog } from '@mechane/logs';
import { LogEvent, WorkspaceCreationConflict } from '@mechane/protocol';
import type { catalog, InstallationAdministratorRequired, ObjectUnavailable, Workspace } from '@mechane/protocol';
import { Micros } from '@mechane/records';
import { SharedWorkspaceCreation } from '@mechane/rpc';
import { Effect } from 'effect';
import { requireInstallationAdministrator } from '../../admission/require-installation-administrator.ts';
import type { WorkInput } from '../../routing/types.ts';
import { workspaceActorLog } from './workspace-actor-log.ts';

/** The installation administrator grant is independent of any workspace owner role. */
export const createWorkspace = Effect.fn('createWorkspace')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.createWorkspace>): Effect.fn.Return<
  Workspace,
  InstallationAdministratorRequired | ObjectUnavailable | WorkspaceCreationConflict
> {
  yield* requireInstallationAdministrator({ settings, caller });

  const dailyAllowanceMicros = Micros.make(settings.dailyAllowanceMicros);

  const result = yield* callDirectory({
    settings,
    call: ({ directory }) =>
      directory.createSharedWorkspace({ principalId: caller.principal.id, ...input, dailyAllowanceMicros }),
    answer: SharedWorkspaceCreation,
  });

  if (SharedWorkspaceCreation.guards.Conflict(result)) {
    return yield* new WorkspaceCreationConflict({ workspaceId: input.id });
  }

  const actor = workspaceActorLog({ caller, workspaceId: result.workspace.id });

  writeLog({ line: { event: LogEvent.WorkspaceCreated, ...actor } });

  return result.workspace;
});
