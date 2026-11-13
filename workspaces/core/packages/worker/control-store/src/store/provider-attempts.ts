import { RecordId, SHA256_PATTERN, UtcDay } from '@mechane/records';
import { Schema } from 'effect';
import type { Allowance } from '../domain.ts';
import type {
  DispatchProviderAttempt,
  ProviderAttempt,
  ProviderAttemptDecision,
  ProviderAttemptDispatch,
  ProviderAttemptIdentity,
  ProviderAttemptRefusal,
  ProviderAttemptScope,
  ProviderAttemptsScope,
  ProviderAttemptStore,
  ReleaseUnusedProviderAttempt,
  SettleProviderAttempt,
} from '../provider-attempt.ts';
import type { StoreContext } from './context.ts';
import { ProviderDispatchRefused, RecordNotFound, StoreConflict } from './errors.ts';
import { StoredChecksum, StoredText, StoredTimestamp } from './row-values.ts';
import { lockWorkspace } from './scope-locks.ts';

const QUERY_MAX_ATTEMPTS = 256;
const AttemptPresence = Schema.Struct({ id: Schema.NullOr(RecordId) });

const AttemptRow = Schema.Struct({
  id: RecordId,
  workspace_id: RecordId,
  mech_id: RecordId,
  activation_id: RecordId,
  generation_task_id: Schema.NullOr(StoredText),
  attempt_ordinal: Schema.Number,
  request_fingerprint: StoredChecksum,
  provider: StoredText,
  model: StoredText,
  reserved_micros: Schema.Number,
  accounting_date: UtcDay,
  actual_micros: Schema.NullOr(Schema.Number),
  upstream_usage: Schema.NullOr(Schema.Record(StoredText, Schema.Unknown)),
  state: Schema.Literals(['reserved', 'dispatched', 'settled', 'released', 'refused']),
  refusal_reason: Schema.NullOr(
    Schema.Literals(['workspace_suspended', 'mech_disabled', 'workspace_allowance', 'mech_allowance']),
  ),
  created_at: StoredTimestamp,
  dispatched_at: Schema.NullOr(StoredTimestamp),
  settled_at: Schema.NullOr(StoredTimestamp),
  released_at: Schema.NullOr(StoredTimestamp),
});

const LimitsRow = Schema.Struct({
  workspace_cap_micros: Schema.Number,
  mech_cap_micros: Schema.Number,
  mech_status: StoredText,
  is_suspended: Schema.Boolean,
  accounting_date: UtcDay,
});

const TotalsRow = Schema.Struct({ workspace_used: Schema.Number, mech_used: Schema.Number });

const AllowanceRow = Schema.Struct({
  cap_micros: Schema.Number,
  spent: Schema.Number,
  reserved: Schema.Number,
  date: StoredText,
});

type Limits = typeof LimitsRow.Type;
type Totals = typeof TotalsRow.Type;
type AllowanceInput = { readonly workspaceId: string; readonly mechId?: string };

type BudgetStore = ProviderAttemptStore & {
  readonly showAllowance: (input: AllowanceInput) => Promise<Allowance | null>;
};

function providerAttempt(value: unknown): ProviderAttempt {
  const row = Schema.decodeUnknownSync(AttemptRow)(value);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    activationId: row.activation_id,
    generationTaskId: row.generation_task_id,
    attemptOrdinal: row.attempt_ordinal,
    requestFingerprint: row.request_fingerprint,
    provider: row.provider,
    model: row.model,
    reservedMicros: row.reserved_micros,
    accountingDate: row.accounting_date,
    actualMicros: row.actual_micros,
    upstreamUsage: row.upstream_usage,
    state: row.state,
    refusalReason: row.refusal_reason,
    createdAt: row.created_at,
    dispatchedAt: row.dispatched_at,
    settledAt: row.settled_at,
    releasedAt: row.released_at,
  };
}

function optionalProviderAttempt(value: unknown): ProviderAttempt | null {
  const row = Schema.decodeUnknownSync(AttemptPresence)(value);

  if (row.id === null) {
    return null;
  }

  return providerAttempt(value);
}

function validateMicros(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new StoreConflict('Spend must be a nonnegative safe integer');
  }
}

function validateIdentity(input: ProviderAttemptIdentity): void {
  validateMicros(input.reservedMicros);

  if (!Number.isSafeInteger(input.attemptOrdinal) || input.attemptOrdinal < 1) {
    throw new StoreConflict('Provider attempt ordinal must be a positive safe integer');
  }

  if (!SHA256_PATTERN.test(input.requestFingerprint) || input.provider.length === 0 || input.model.length === 0) {
    throw new StoreConflict('Provider attempt identity is invalid');
  }
}

function checkIdentity(current: ProviderAttempt, input: ProviderAttemptIdentity): void {
  const hasSameScope = current.workspaceId === input.workspaceId && current.mechId === input.mechId;

  const hasSameGeneration =
    current.activationId === input.activationId && current.generationTaskId === (input.generationTaskId ?? null);

  const hasSameCausation = hasSameGeneration && current.attemptOrdinal === input.attemptOrdinal;

  const hasSameRequest =
    current.requestFingerprint === input.requestFingerprint &&
    current.provider === input.provider &&
    current.model === input.model;

  const hasSameReservation = hasSameRequest && current.reservedMicros === input.reservedMicros;

  if (!hasSameScope || !hasSameCausation || !hasSameReservation) {
    throw new StoreConflict('Provider attempt identity changed');
  }
}

function decision(attempt: ProviderAttempt, wasCreated: boolean): ProviderAttemptDecision {
  if (attempt.state === 'refused') {
    if (attempt.refusalReason === null) {
      throw new StoreConflict('Provider refusal has no reason');
    }

    return { status: 'refused', reason: attempt.refusalReason, attempt, wasCreated };
  }

  return { status: 'admitted', attempt, wasCreated };
}

type AdditionalSpend = { readonly reservedMicros: number };

function refusalReason(input: AdditionalSpend, limits: Limits, totals: Totals): ProviderAttemptRefusal | null {
  if (limits.is_suspended) {
    return 'workspace_suspended';
  }

  if (limits.mech_status !== 'active') {
    return 'mech_disabled';
  }

  if (totals.workspace_used + input.reservedMicros > limits.workspace_cap_micros) {
    return 'workspace_allowance';
  }

  if (totals.mech_used + input.reservedMicros > limits.mech_cap_micros) {
    return 'mech_allowance';
  }

  return null;
}

async function readAttempt(context: StoreContext, input: ProviderAttemptScope): Promise<ProviderAttempt | null> {
  const found = await context.client.query(
    'SELECT * FROM mechane.provider_attempts WHERE id=$1 AND workspace_id=$2 AND mech_id=$3',
    [input.id, input.workspaceId, input.mechId],
  );

  if (found.rows.length === 0) {
    return null;
  }

  return providerAttempt(found.rows[0]);
}

async function lockAttempt(context: StoreContext, input: DispatchProviderAttempt): Promise<ProviderAttempt> {
  await lockWorkspace({ client: context.client, workspaceId: input.workspaceId });

  const found = await context.client.query(
    'SELECT * FROM mechane.provider_attempts WHERE id=$1 AND workspace_id=$2 AND mech_id=$3 FOR UPDATE',
    [input.id, input.workspaceId, input.mechId],
  );

  if (found.rows.length === 0) {
    throw new RecordNotFound('Provider attempt was not found');
  }

  const current = providerAttempt(found.rows[0]);

  if (current.requestFingerprint !== input.requestFingerprint) {
    throw new StoreConflict('Provider attempt fingerprint changed');
  }

  return current;
}

function additionalDispatchCharge(current: ProviderAttempt, limits: Limits): number {
  if (current.accountingDate === limits.accounting_date) {
    return 0;
  }

  return current.reservedMicros;
}

async function readLimits(context: StoreContext, input: ProviderAttemptScope): Promise<Limits> {
  const limited = await context.client.query(
    `SELECT workspace.daily_cap_micros AS workspace_cap_micros,mech.daily_cap_micros AS mech_cap_micros,
       mech.status AS mech_status,COALESCE((workspace.policy->>'isSuspended')::boolean,false) AS is_suspended,
       to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') AS accounting_date
     FROM mechane.workspaces workspace JOIN mechane.mechs mech ON mech.workspace_id=workspace.id
     WHERE workspace.id=$1 AND mech.id=$2 FOR UPDATE OF mech`,
    [input.workspaceId, input.mechId],
  );

  if (limited.rows.length === 0) {
    throw new RecordNotFound('Provider attempt mech was not found');
  }

  return Schema.decodeUnknownSync(LimitsRow)(limited.rows[0]);
}

async function readTotals(context: StoreContext, input: ProviderAttemptScope): Promise<Totals> {
  const counted = await context.client.query(
    `SELECT COALESCE(sum(charged_micros),0)::bigint AS workspace_used,
       COALESCE(sum(charged_micros) FILTER(WHERE mech_id=$2),0)::bigint AS mech_used FROM (
         SELECT mech_id,COALESCE(settled_micros,reserved_micros) AS charged_micros
         FROM mechane.spend_reservations WHERE workspace_id=$1 AND state<>'refused'
           AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
         UNION ALL SELECT mech_id,COALESCE(actual_micros,reserved_micros) AS charged_micros
         FROM mechane.provider_attempts WHERE workspace_id=$1 AND state NOT IN ('refused','released')
           AND accounting_date=(now() AT TIME ZONE 'UTC')::date
       ) charges`,
    [input.workspaceId, input.mechId],
  );

  return Schema.decodeUnknownSync(TotalsRow)(counted.rows[0]);
}

export function createProviderAttemptStore(context: StoreContext): BudgetStore {
  return {
    async reserveProviderAttempt(input: ProviderAttemptIdentity): Promise<ProviderAttemptDecision> {
      validateIdentity(input);

      return await context.atomic(async (transaction) => {
        await lockWorkspace({ client: transaction.client, workspaceId: input.workspaceId });

        const limits = await readLimits(transaction, input);

        const previous = await transaction.client.query('SELECT * FROM mechane.provider_attempts WHERE id=$1', [
          input.id,
        ]);

        if (previous.rows.length > 0) {
          const current = providerAttempt(previous.rows[0]);

          checkIdentity(current, input);

          return decision(current, false);
        }

        const totals = await readTotals(transaction, input);
        const refusal = refusalReason(input, limits, totals);
        const state = attemptState(refusal);

        const inserted = await transaction.client.query(
          `INSERT INTO mechane.provider_attempts(id,workspace_id,mech_id,activation_id,generation_task_id,attempt_ordinal,
             request_fingerprint,provider,model,reserved_micros,state,refusal_reason)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [
            input.id,
            input.workspaceId,
            input.mechId,
            input.activationId,
            input.generationTaskId ?? null,
            input.attemptOrdinal,
            input.requestFingerprint,
            input.provider,
            input.model,
            input.reservedMicros,
            state,
            refusal,
          ],
        );

        return decision(providerAttempt(inserted.rows[0]), true);
      });
    },
    async getProviderAttempt(input: ProviderAttemptScope): Promise<ProviderAttempt | null> {
      return await readAttempt(context, input);
    },
    async getProviderAttempts(input: ProviderAttemptsScope): Promise<ReadonlyArray<ProviderAttempt | null>> {
      const attempts: Array<ProviderAttempt | null> = [];

      for (let offset = 0; offset < input.ids.length; offset += QUERY_MAX_ATTEMPTS) {
        const ids = input.ids.slice(offset, offset + QUERY_MAX_ATTEMPTS);

        const found = await context.client.query(
          `SELECT attempt.* FROM unnest($3::uuid[]) WITH ORDINALITY AS requested(id, position)
           LEFT JOIN mechane.provider_attempts AS attempt
             ON attempt.id=requested.id AND attempt.workspace_id=$1 AND attempt.mech_id=$2
           ORDER BY requested.position`,
          [input.workspaceId, input.mechId, ids],
        );

        attempts.push(...found.rows.map(optionalProviderAttempt));
      }

      return attempts;
    },
    async markProviderAttemptDispatched(input: DispatchProviderAttempt): Promise<ProviderAttemptDispatch> {
      return await context.atomic(async (transaction) => {
        const current = await lockAttempt(transaction, input);

        if (current.state === 'dispatched') {
          return { ...current, wasMarked: false };
        }

        if (current.state !== 'reserved') {
          throw new StoreConflict('Provider attempt cannot be dispatched');
        }

        const limits = await readLimits(transaction, input);
        const totals = await readTotals(transaction, input);
        const reservedMicros = additionalDispatchCharge(current, limits);
        const refusal = refusalReason({ reservedMicros }, limits, totals);

        if (refusal !== null) {
          throw new ProviderDispatchRefused({ reason: refusal });
        }

        const updated = await transaction.client.query(
          `UPDATE mechane.provider_attempts SET state='dispatched',dispatched_at=now(),
             accounting_date=(now() AT TIME ZONE 'UTC')::date WHERE id=$1 RETURNING *`,
          [input.id],
        );

        return { ...providerAttempt(updated.rows[0]), wasMarked: true };
      });
    },
    async releaseUnusedProviderAttempt(input: ReleaseUnusedProviderAttempt): Promise<ProviderAttempt> {
      return await context.atomic(async (transaction) => {
        const current = await lockAttempt(transaction, input);

        if (current.state === 'released') {
          return current;
        }

        if (current.state !== 'reserved') {
          throw new StoreConflict('Dispatched provider attempt cannot be released as unused');
        }

        const updated = await transaction.client.query(
          "UPDATE mechane.provider_attempts SET state='released',released_at=now() WHERE id=$1 RETURNING *",
          [input.id],
        );

        return providerAttempt(updated.rows[0]);
      });
    },
    async settleProviderAttempt(input: SettleProviderAttempt): Promise<ProviderAttempt> {
      validateMicros(input.actualMicros);

      return await context.atomic(async (transaction) => {
        const current = await lockAttempt(transaction, input);

        if (current.state === 'settled') {
          const same = await transaction.client.query<{ readonly is_same: boolean }>(
            'SELECT actual_micros=$2 AND upstream_usage=$3::jsonb AS is_same FROM mechane.provider_attempts WHERE id=$1',
            [input.id, input.actualMicros, input.upstreamUsage],
          );

          if (same.rows[0]?.is_same !== true) {
            throw new StoreConflict('Provider attempt settlement changed');
          }

          return current;
        }

        if (current.state !== 'dispatched') {
          throw new StoreConflict('Provider attempt cannot be settled');
        }

        const updated = await transaction.client.query(
          `UPDATE mechane.provider_attempts SET state='settled',actual_micros=$2,upstream_usage=$3,settled_at=now()
           WHERE id=$1 RETURNING *`,
          [input.id, input.actualMicros, input.upstreamUsage],
        );

        return providerAttempt(updated.rows[0]);
      });
    },
    async showAllowance({ workspaceId, mechId }: AllowanceInput): Promise<Allowance | null> {
      const result = await context.client.query(
        `SELECT COALESCE(mech.daily_cap_micros,workspace.daily_cap_micros) AS cap_micros,
           COALESCE(sum(charges.spent),0)::bigint AS spent,COALESCE(sum(charges.reserved),0)::bigint AS reserved,
           to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') AS date
         FROM mechane.workspaces workspace LEFT JOIN mechane.mechs mech ON mech.workspace_id=workspace.id AND mech.id=$2
         LEFT JOIN (
           SELECT workspace_id,mech_id,settled_micros AS spent,
             CASE WHEN state='reserved' THEN reserved_micros ELSE 0 END AS reserved,(created_at AT TIME ZONE 'UTC')::date AS accounting_date
           FROM mechane.spend_reservations WHERE state<>'refused'
           UNION ALL SELECT workspace_id,mech_id,actual_micros AS spent,
             CASE WHEN state IN ('reserved','dispatched') THEN reserved_micros ELSE 0 END AS reserved,accounting_date
           FROM mechane.provider_attempts WHERE state NOT IN ('refused','released')
         ) charges ON charges.workspace_id=workspace.id AND ($2::uuid IS NULL OR charges.mech_id=$2)
           AND charges.accounting_date=(now() AT TIME ZONE 'UTC')::date
         WHERE workspace.id=$1 AND ($2::uuid IS NULL OR mech.id IS NOT NULL)
         GROUP BY workspace.daily_cap_micros,mech.daily_cap_micros`,
        [workspaceId, mechId ?? null],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = Schema.decodeUnknownSync(AllowanceRow)(result.rows[0]);

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

function attemptState(refusal: ProviderAttemptRefusal | null): 'reserved' | 'refused' {
  if (refusal === null) {
    return 'reserved';
  }

  return 'refused';
}
