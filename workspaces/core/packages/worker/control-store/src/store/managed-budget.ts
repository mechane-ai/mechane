import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import type { StoreContext } from './context.ts';
import { exceedsConsumed, managedUsageMeter, readManagedSessionUsage } from './managed-session-usage.ts';
import type { ManagedUsageScope } from './managed-session-usage.ts';
import { ManagedStoreError } from './managed/managed-record.ts';

const Budget = Schema.Struct({
  type: Schema.Literal('limit'),
  max_list_cost: Schema.Struct({
    amount: Schema.String.check(Schema.isPattern(/^[1-9][0-9]*$/u)),
    currency: Schema.Literal('USD'),
  }),
});

type SessionScope = Pick<ManagedUsageScope, 'workspaceId' | 'sessionId'>;
type LedgerScope = SessionScope & { readonly mechId?: string };
type BudgetChange = SessionScope & { readonly budget: unknown };

type ActivityReceipt = SessionScope & {
  readonly threadId: string;
  readonly eventId: string;
  readonly at: string;
  readonly isRunning: boolean;
};

const CurrentBudget = Schema.Struct({ budget_cents: Schema.NullOr(Budget.fields.max_list_cost.fields.amount) });

export function managedBudgetCents(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Schema.is(Budget)(value)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'budget must set a positive whole number of USD cents');
  }

  return value.max_list_cost.amount;
}

async function lockManagedBudget(context: StoreContext, { workspaceId, sessionId, mechId }: LedgerScope) {
  const result = await context.client.query(
    `SELECT budget_cents::text FROM mechane.managed_sessions WHERE workspace_id=$1 AND id=$2
       AND ($3::uuid IS NULL OR runtime_mech_id=$3 OR $3::text IN (SELECT value FROM jsonb_each_text(child_runtime_mech_ids)))
       FOR NO KEY UPDATE`,
    [workspaceId, sessionId, mechId ?? null],
  );

  if (result.rows.length === 0) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Session was not found');
  }

  return Schema.decodeUnknownSync(CurrentBudget)(result.rows[0]).budget_cents;
}

export async function managedBudgetReached(context: StoreContext, scope: LedgerScope): Promise<boolean> {
  const limit = await lockManagedBudget(context, scope);

  if (limit === null) {
    return false;
  }

  const meter = await managedUsageMeter(context, scope);

  return meter.is_unpriced || !exceedsConsumed(limit, meter.consumed_units);
}

export async function updateManagedSessionBudget(context: StoreContext, input: BudgetChange): Promise<void> {
  const next = managedBudgetCents(input.budget);
  const current = await lockManagedBudget(context, input);

  if (next !== null) {
    if (current === null) {
      throw new ManagedStoreError(
        HttpStatusCode.BadRequest,
        'A budget cannot be added to an existing unbudgeted session',
      );
    }

    const meter = await managedUsageMeter(context, input);

    if (meter.is_unpriced) {
      throw new ManagedStoreError(
        HttpStatusCode.BadRequest,
        'Cannot update a budget when the session contains unpriced usage',
      );
    }

    if (!exceedsConsumed(next, meter.consumed_units)) {
      throw new ManagedStoreError(
        HttpStatusCode.BadRequest,
        "budget.max_list_cost must be greater than the session's consumed list cost",
      );
    }
  }

  if (current === next) {
    return;
  }

  await context.client.query(
    'INSERT INTO mechane.managed_budget_changes(workspace_id,session_id,previous_cents) VALUES($1,$2,$3)',
    [input.workspaceId, input.sessionId, current],
  );
  await context.client.query('UPDATE mechane.managed_sessions SET budget_cents=$3 WHERE workspace_id=$1 AND id=$2', [
    input.workspaceId,
    input.sessionId,
    next,
  ]);
}

export function createManagedUsageStore(context: StoreContext) {
  return {
    getManagedSessionUsage: async (scope: ManagedUsageScope) => await readManagedSessionUsage(context, scope),
    recordManagedThreadActivity: async (input: ActivityReceipt): Promise<void> => {
      const values = [input.workspaceId, input.sessionId, input.eventId, input.threadId, input.at, input.isRunning];

      const result = await context.client.query(
        `INSERT INTO mechane.managed_usage_activity (workspace_id,session_id,event_id,thread_id,at,running)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        values,
      );

      if (result.rowCount === 0) {
        const existing = await context.client.query(
          `SELECT 1 FROM mechane.managed_usage_activity
           WHERE workspace_id=$1 AND session_id=$2 AND event_id=$3 AND thread_id=$4 AND at=$5 AND running=$6`,
          values,
        );

        if (existing.rowCount !== 1) {
          throw new ManagedStoreError(HttpStatusCode.Conflict, 'Thread activity receipt changed');
        }
      }
    },
  };
}
