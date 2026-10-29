import type { Micros, PrincipalId, WorkspaceId } from '@mechane/records';
import type { WorkspaceMemberChange } from './workspace-members.schemas.ts';

export type CreateSharedWorkspaceInput = {
  readonly principalId: typeof PrincipalId.Encoded;
  readonly id: WorkspaceId;
  readonly name: string;
  readonly dailyAllowanceMicros: Micros;
};

export type ChangeWorkspaceMemberInput = {
  readonly principalId: typeof PrincipalId.Encoded;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly memberPrincipalId: PrincipalId;
  readonly change: WorkspaceMemberChange;
};
