import type { MembershipRole } from '@mechane/protocol';
import type { Micros, PrincipalId, WorkspaceId } from '@mechane/records';
import type { DateTime } from 'effect';
import type { WorkspaceMembershipInput } from '../inputs.types.ts';

/** Creation records one stable workspace ID and the principal that owns its retry intent. */
export type SharedWorkspaceInput = {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly principalId: typeof PrincipalId.Encoded;
  readonly dailyAllowanceMicros: Micros;
  readonly now: DateTime.Utc;
};

/** A role update preserves the membership's original creation time. */
export type SetWorkspaceMemberInput = WorkspaceMembershipInput & {
  readonly role: MembershipRole;
  readonly now: DateTime.Utc;
};
