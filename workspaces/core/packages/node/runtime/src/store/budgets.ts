import { Schema } from 'effect';
import type { Allowance, ModelUsage, SpendReservation } from '../domain.ts';
import type { StoreContext } from './context.ts';
import { RecordNotFound, StoreConflict } from './errors.ts';
import { advanceRunVersion } from './run-version.ts';

const UsageSchema = Schema.Struct({
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  cacheReadTokens: Schema.Number,
  cacheWriteTokens: Schema.Number,
});

const ReservationSchema = Schema.Struct({
  id: Schema.String,
  run_id: Schema.String,
  workspace_id: Schema.String,
  mech_id: Schema.String,
  model: Schema.String,
  reserved_micros: Schema.Number,
  settled_micros: Schema.NullOr(Schema.Number),
  usage: Schema.NullOr(UsageSchema),
  state: Schema.Literals(['reserved', 'settled', 'refused']),
  created_at: Schema.String,
  settled_at: Schema.NullOr(Schema.String),
});

const LimitSchema = Schema.Struct({
  workspace_cap_micros: Schema.Number,
  mech_cap_micros: Schema.Number,
  status: Schema.String,
  mech_status: Schema.String,
  is_cancelled: Schema.Boolean,
  is_suspended: Schema.Boolean,
});

const TotalsSchema = Schema.Struct({ workspace_used: Schema.Number, mech_used: Schema.Number });

const AllowanceSchema = Schema.Struct({
  cap_micros: Schema.Number,
  spent: Schema.Number,
  reserved: Schema.Number,
  date: Schema.String,
});

type ReserveInput = {
  readonly id: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly model: string;
  readonly reservedMicros: number;
};

type SettleInput = { readonly id: string; readonly actualMicros: number; readonly usage: ModelUsage | null };
type AllowanceInput = { readonly workspaceId: string; readonly mechId?: string };

function reservation(value: unknown): SpendReservation {
  const row = Schema.decodeUnknownSync(ReservationSchema)(value);

  return {
    id: row.id,
    runId: row.run_id,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    model: row.model,
    reservedMicros: row.reserved_micros,
    settledMicros: row.settled_micros,
    usage: row.usage,
    state: row.state,
    createdAt: row.created_at,
    settledAt: row.settled_at,
  };
}

function validateMicros(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new StoreConflict('Spend must be a nonnegative safe integer');
  }
}

export function createBudgetStore(context: StoreContext) {
  return {
    reserveModelSpend: async (input: ReserveInput) => {
      validateMicros(input.reservedMicros);

      return await context.atomic(async ({ client }) => {
        const limits = await client.query(
          `
          SELECT w.daily_cap_micros AS workspace_cap_micros, m.daily_cap_micros AS mech_cap_micros, r.status,m.status AS mech_status,
                 r.cancel_requested_at IS NOT NULL AS is_cancelled,
                 COALESCE((w.policy->>'isSuspended')::boolean,false) AS is_suspended
          FROM mechane.workspaces w JOIN mechane.mechs m ON m.workspace_id=w.id
          JOIN mechane.runs r ON r.mech_id=m.id AND r.workspace_id=w.id
          WHERE w.id=$1 AND m.id=$2 AND r.id=$3 FOR UPDATE OF w,m,r`,
          [input.workspaceId, input.mechId, input.runId],
        );

        if (limits.rows.length === 0) {
          throw new RecordNotFound('Model run was not found');
        }

        const prior = await client.query('SELECT * FROM mechane.spend_reservations WHERE id=$1', [input.id]);

        if (prior.rows.length > 0) {
          const existing = reservation(prior.rows[0]);

          const hasSameScope =
            existing.runId === input.runId &&
            existing.workspaceId === input.workspaceId &&
            existing.mechId === input.mechId;

          const hasSameRequest = existing.model === input.model && existing.reservedMicros === input.reservedMicros;

          if (!hasSameScope || !hasSameRequest) {
            throw new StoreConflict('Model reservation identity changed');
          }

          return { reservation: existing, wasCreated: false };
        }

        const limit = Schema.decodeUnknownSync(LimitSchema)(limits.rows[0]);

        const totals = await client.query(
          `
          SELECT COALESCE(sum(COALESCE(settled_micros,reserved_micros)),0)::bigint AS workspace_used,
                 COALESCE(sum(COALESCE(settled_micros,reserved_micros)) FILTER(WHERE mech_id=$2),0)::bigint AS mech_used
          FROM mechane.spend_reservations
          WHERE workspace_id=$1 AND state<>'refused'
            AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
          [input.workspaceId, input.mechId],
        );

        const total = Schema.decodeUnknownSync(TotalsSchema)(totals.rows[0]);

        const isAffordable =
          total.workspace_used + input.reservedMicros <= limit.workspace_cap_micros &&
          total.mech_used + input.reservedMicros <= limit.mech_cap_micros;

        const isRunActive = !limit.is_cancelled && limit.status === 'running';
        const isMechEnabled = !limit.is_suspended && limit.mech_status === 'active';
        const canDispatch = isRunActive && isMechEnabled && isAffordable;

        const state = reservationState(canDispatch);

        const created = await client.query(
          `
          INSERT INTO mechane.spend_reservations(id,run_id,workspace_id,mech_id,model,reserved_micros,state)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [input.id, input.runId, input.workspaceId, input.mechId, input.model, input.reservedMicros, state],
        );

        if (!isAffordable && limit.status === 'running' && !limit.is_cancelled) {
          await client.query("UPDATE mechane.runs SET failure_reason='allowance_exhausted' WHERE id=$1", [input.runId]);
        }

        await advanceRunVersion({ client, runId: input.runId });

        return { reservation: reservation(created.rows[0]), wasCreated: true };
      });
    },
    settleModelSpend: async ({ id, actualMicros, usage }: SettleInput): Promise<void> => {
      validateMicros(actualMicros);

      await context.atomic(async ({ client }) => {
        const found = await client.query('SELECT * FROM mechane.spend_reservations WHERE id=$1 FOR UPDATE', [id]);

        if (found.rows.length === 0) {
          throw new RecordNotFound('Model reservation was not found');
        }

        const current = reservation(found.rows[0]);

        if (current.state === 'settled') {
          if (current.settledMicros !== actualMicros || JSON.stringify(current.usage) !== JSON.stringify(usage)) {
            throw new StoreConflict('Model settlement changed');
          }

          return;
        }

        if (current.state !== 'reserved' || (usage === null && actualMicros !== current.reservedMicros)) {
          throw new StoreConflict('Model reservation cannot be settled');
        }

        await client.query(
          `
          UPDATE mechane.spend_reservations SET state='settled',settled_micros=$2,usage=$3,settled_at=now()
          WHERE id=$1`,
          [id, actualMicros, usage],
        );
        await advanceRunVersion({ client, runId: current.runId });
      });
    },
    showAllowance: async ({ workspaceId, mechId }: AllowanceInput): Promise<Allowance | null> => {
      const rows = await context.client.query(
        `
        SELECT COALESCE(m.daily_cap_micros,w.daily_cap_micros) AS cap_micros,
          COALESCE(sum(s.settled_micros) FILTER(WHERE s.state='settled'),0)::bigint AS spent,
          COALESCE(sum(s.reserved_micros) FILTER(WHERE s.state='reserved'),0)::bigint AS reserved,
          to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') AS date
        FROM mechane.workspaces w LEFT JOIN mechane.mechs m ON m.workspace_id=w.id AND m.id=$2
        LEFT JOIN mechane.spend_reservations s ON s.workspace_id=w.id AND ($2::uuid IS NULL OR s.mech_id=$2)
          AND s.created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        WHERE w.id=$1 AND ($2::uuid IS NULL OR m.id IS NOT NULL)
        GROUP BY w.daily_cap_micros,m.daily_cap_micros`,
        [workspaceId, mechId ?? null],
      );

      if (rows.rows.length === 0) {
        return null;
      }

      const row = Schema.decodeUnknownSync(AllowanceSchema)(rows.rows[0]);

      return {
        workspaceId,
        mechId: mechId ?? null,
        date: row.date,
        capMicros: row.cap_micros,
        spentMicros: row.spent,
        reservedMicros: row.reserved,
      };
    },
  };
}

function reservationState(canDispatch: boolean): SpendReservation['state'] {
  if (canDispatch) {
    return 'reserved';
  }

  return 'refused';
}
