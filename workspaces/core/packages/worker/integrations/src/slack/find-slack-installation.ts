import type { SlackInstallation } from '@mechane/protocol';
import { DurableObjectClass, ObjectUnavailable } from '@mechane/protocol';
import type { SlackConnectionId, WorkspaceId } from '@mechane/records';
import { SlackInstallationAnswer, workspaceStub } from '@mechane/rpc';
import type { ObjectBindings } from '@mechane/rpc';
import { capturePromise } from '@mechane/utilities';
import { Result, Schema } from 'effect';
import type { Option } from 'effect';

type FindSlackInstallationInput = {
  readonly settings: ObjectBindings;
  readonly workspaceId: WorkspaceId;
  readonly connectionId: SlackConnectionId;
};

/** A missing connection is distinct from unavailable storage, so delivery can stop or retry appropriately. */
export async function findSlackInstallation({
  settings,
  workspaceId,
  connectionId,
}: FindSlackInstallationInput): Promise<Result.Result<Option.Option<SlackInstallation>, ObjectUnavailable>> {
  const workspace = workspaceStub({ bindings: settings, workspaceId });
  const promise = workspace.slackInstallation({ connectionId });
  const response = await capturePromise({ promise });
  const decode = Schema.decodeUnknownResult(SlackInstallationAnswer);
  const decoded = Result.flatMap(response, decode);

  return Result.mapError(
    decoded,
    () =>
      new ObjectUnavailable({ objectClass: DurableObjectClass.Workspace, reason: 'Slack installation lookup failed' }),
  );
}
