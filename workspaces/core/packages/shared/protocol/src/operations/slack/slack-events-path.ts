import type { SlackConnectionId, WorkspaceId } from '@mechane/records';

type SlackEventsPathInput = { readonly workspaceId: WorkspaceId; readonly connectionId: SlackConnectionId };

/** The signed event endpoint for one configured workspace installation. */
export function slackEventsPath({ workspaceId, connectionId }: SlackEventsPathInput): string {
  return `/integrations/slack/${encodeURIComponent(workspaceId)}/${encodeURIComponent(connectionId)}/events`;
}
