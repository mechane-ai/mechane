import { WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import type { WorkspaceOwnerRefusal } from '@mechane/rpc';
import { Match } from 'effect';

type MemberOwnerFailureInput = {
  readonly refusal: WorkspaceOwnerRefusal;
  readonly workspaceId: typeof WorkspaceId.Encoded;
};

/** Absent and foreign workspaces share the same public refusal. */
export function memberOwnerFailure({
  refusal,
  workspaceId,
}: MemberOwnerFailureInput): WorkspaceNotFound | WorkspaceOwnerRequired {
  const workspace = WorkspaceId.make(workspaceId);

  return Match.valueTags(refusal, {
    NotMember: () => new WorkspaceNotFound({ workspaceId }),
    OwnerRequired: () => new WorkspaceOwnerRequired({ workspaceId: workspace }),
  });
}
