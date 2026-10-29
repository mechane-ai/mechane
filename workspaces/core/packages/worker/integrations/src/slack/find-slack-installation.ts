import type { SlackInstallation } from '@mechane/deployment';
import type { SlackConnectionId, WorkspaceId } from '@mechane/records';
import { Option } from 'effect';

type FindSlackInstallationInput = {
  /** Absent when no Slack installations are configured. */
  readonly installations: Option.Option<ReadonlyArray<SlackInstallation>>;
  readonly workspaceId: WorkspaceId;
  readonly connectionId: SlackConnectionId;
};

/** Selects installation metadata only within its configured Mechane workspace. */
export function findSlackInstallation({
  installations,
  workspaceId,
  connectionId,
}: FindSlackInstallationInput): Option.Option<SlackInstallation> {
  if (Option.isNone(installations)) {
    return Option.none();
  }

  const matches: (installation: SlackInstallation) => boolean = (installation) =>
    installation.workspaceId === workspaceId && installation.id === connectionId;

  const found = installations.value.find(matches);

  return Option.fromUndefinedOr(found);
}
