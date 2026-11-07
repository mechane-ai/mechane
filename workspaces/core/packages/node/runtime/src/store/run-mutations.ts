import type { StoreContext } from './context.ts';
import { AdmissionRefused } from './errors.ts';

type RunMutationScope = { readonly runId?: string | null; readonly workspaceId?: string; readonly mechId?: string };

type RunMutationInput<Result> = {
  readonly context: StoreContext;
  readonly scope: RunMutationScope;
  readonly mutation: (context: StoreContext) => Promise<Result>;
};

export async function withRunMutation<Result>({ context, scope, mutation }: RunMutationInput<Result>): Promise<Result> {
  return await context.atomic(async (transaction) => {
    if (scope.runId !== undefined && scope.runId !== null) {
      await transaction.client.query(
        `SELECT m.id FROM mechane.mechs m JOIN mechane.runs r ON r.mech_id=m.id
         WHERE r.id=$1 AND ($2::uuid IS NULL OR r.workspace_id=$2) AND ($3::uuid IS NULL OR r.mech_id=$3)
         FOR UPDATE OF m`,
        [scope.runId, scope.workspaceId ?? null, scope.mechId ?? null],
      );

      // A joined read can predate cancellation while waiting for the mech lock.
      const active = await transaction.client.query(
        `SELECT id FROM mechane.runs
         WHERE id=$1 AND ($2::uuid IS NULL OR workspace_id=$2) AND ($3::uuid IS NULL OR mech_id=$3)
           AND status='running' AND cancel_requested_at IS NULL FOR UPDATE`,
        [scope.runId, scope.workspaceId ?? null, scope.mechId ?? null],
      );

      if (active.rows.length === 0) {
        throw new AdmissionRefused('Run cannot change its environment');
      }
    }

    return await mutation(transaction);
  });
}
