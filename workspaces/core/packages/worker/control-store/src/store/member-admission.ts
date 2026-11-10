import { WorkspaceNotFound } from '@mechane/protocol';
import { RecordId } from '@mechane/records';
import type { StoreContext } from './context.ts';

type MemberAdmissionInput<Result> = {
  readonly workspaceId: string;
  readonly principalId: string;
  readonly run: (authorize: () => Promise<void>) => Promise<Result>;
};

export async function lockMember(context: StoreContext, workspaceId: string, principalId: string): Promise<void> {
  const membership = await context.client.query(
    'SELECT principal_id FROM mechane.memberships WHERE workspace_id=$1 AND principal_id=$2 FOR SHARE',
    [workspaceId, principalId],
  );

  if (membership.rowCount === 0) {
    throw new WorkspaceNotFound({ workspaceId: RecordId.make(workspaceId) });
  }
}

export function createMemberAdmissionStore(context: StoreContext) {
  return {
    /** The caller acquires its native transaction before authorizing and retains this lease through its commit. */
    async withMemberAdmission<Result>({
      workspaceId,
      principalId,
      run,
    }: MemberAdmissionInput<Result>): Promise<Result> {
      return await context.atomic(async (transaction) => {
        async function authorize(): Promise<void> {
          await lockMember(transaction, workspaceId, principalId);
        }

        return await run(authorize);
      });
    },
  };
}
