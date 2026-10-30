import { callDirectory, callWorkspace } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import type { ObjectUnavailable, SlackInstallation } from '@mechane/protocol';
import type { SlackConnectionId, WorkspaceId } from '@mechane/records';
import { SlackInstallationAnswer, WorkspacePresence } from '@mechane/rpc';
import { Effect, Option } from 'effect';

type ReadSlackInstallationInput = {
  readonly settings: WorkerSettings;
  readonly workspaceId: WorkspaceId;
  readonly connectionId: SlackConnectionId;
};

/** Anonymous callbacks may inspect registered workspaces, but cannot allocate arbitrary object databases. */
export const readSlackInstallation = Effect.fn('readSlackInstallation')(function* ({
  settings,
  workspaceId,
  connectionId,
}: ReadSlackInstallationInput): Effect.fn.Return<Option.Option<SlackInstallation>, ObjectUnavailable> {
  const { isPresent } = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.workspaceExists({ workspaceId }),
    answer: WorkspacePresence,
  });

  if (!isPresent) {
    return Option.none();
  }

  return yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.slackInstallation({ connectionId }),
    answer: SlackInstallationAnswer,
  });
});
