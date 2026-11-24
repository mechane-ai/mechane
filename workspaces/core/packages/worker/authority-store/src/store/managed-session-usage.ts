import { HttpStatusCode, UNSIGNED_INTEGER_PATTERN } from '@mechane/records';
import { Schema } from 'effect';
import type { StoreContext } from './context.ts';
import { ManagedStoreError } from './managed-record.ts';
import { StoredText } from './row-values.ts';

export type ManagedUsageScope = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly threadId?: string;
  readonly asOf?: string;
};

const UnsignedAmount = Schema.String.check(Schema.isPattern(UNSIGNED_INTEGER_PATTERN));

const Meter = Schema.Struct({
  id: StoredText,
  is_unpriced: Schema.Boolean,
  has_cache_detail: Schema.Boolean,
  has_token_usage: Schema.Boolean,
  budget_cents: Schema.NullOr(UnsignedAmount),
  consumed_units: UnsignedAmount,
  list_cents: UnsignedAmount,
  active_seconds: Schema.Number,
  thread_active_seconds: Schema.Number,
  input_tokens: Schema.Number,
  output_tokens: Schema.Number,
  cached_tokens: Schema.Number,
  writes_1h: Schema.Number,
  writes_5m: Schema.Number,
  search_count: Schema.Number,
  fetch_count: Schema.Number,
});

function managedBudget(amount: string | null) {
  if (amount === null) {
    return null;
  }

  return { type: 'limit', max_list_cost: { amount, currency: 'USD' } } as const;
}

// Express costs in picodollars times 3,600 to preserve exact hourly prices through the budget comparison.
const unitsPerCent = 36_000_000_000_000n;

export function exceedsConsumed(cents: string, units: string): boolean {
  return BigInt(cents) * unitsPerCent > BigInt(units);
}

type MultipleSessions = {
  readonly workspaceId: string;
  readonly sessionIds: ReadonlyArray<string>;
  readonly threadId?: string;
  readonly asOf?: string;
};

async function usageMeters(context: StoreContext, scope: MultipleSessions) {
  const result = await context.client.query(
    `WITH boundary AS (
       SELECT coalesce($4::timestamptz,statement_timestamp()) AS at,
         coalesce($4::timestamptz+interval '1 millisecond',statement_timestamp()) AS through
     )
     SELECT s.id,COALESCE((
       SELECT previous_cents FROM mechane.managed_budget_changes
       WHERE $4::timestamptz IS NOT NULL AND workspace_id=s.workspace_id AND session_id=s.id AND changed_at>=boundary.through
       ORDER BY changed_at,revision LIMIT 1),s.budget_cents)::text AS budget_cents,billed.*
     FROM mechane.managed_sessions s CROSS JOIN boundary CROSS JOIN LATERAL (
     WITH activity AS (
       SELECT at,running,lead(at,1,boundary.at) OVER
         (PARTITION BY thread_id ORDER BY at,received_at,event_id) AS until
       FROM mechane.managed_usage_activity
       WHERE workspace_id=s.workspace_id AND session_id=s.id AND at<=boundary.at AND ($3::text IS NULL OR thread_id=$3)
     ), periods AS (
       SELECT range_agg(tstzrange(at,until,'[)')) AS spans,
         coalesce(sum(extract(epoch FROM until-at)),0) AS thread_active FROM activity WHERE running AND until>at
     ), seconds AS (
       SELECT (SELECT coalesce(sum(extract(epoch FROM upper(span)-lower(span))),0) FROM unnest(spans) AS span) AS active,
         thread_active FROM periods
     ), observations AS (
       SELECT CASE WHEN settled_at<boundary.through THEN list_cost_picodollars END AS price,
         CASE WHEN settled_at<boundary.through THEN upstream_usage END AS upstream_usage
       FROM mechane.provider_attempts WHERE workspace_id=s.workspace_id AND session_id=s.id AND state IN ('settled','dispatched')
         AND (settled_at<boundary.through OR usage_unconfirmed_at<boundary.through OR usage_due_at<boundary.through)
         AND ($3::text IS NULL OR thread_id=$3)
     ), attempts AS (
       SELECT price,
         (upstream_usage->>'prompt_tokens')::bigint AS prompt,
         (upstream_usage->>'completion_tokens')::bigint AS completion,
         coalesce((upstream_usage#>>'{prompt_tokens_details,cached_tokens}')::bigint,0) AS cached,
         coalesce((upstream_usage#>>'{prompt_tokens_details,cache_write_tokens}')::bigint,0) AS written,
         coalesce((upstream_usage#>>'{prompt_tokens_details,cache_write_1h_tokens}')::bigint,0) AS writes_1h,
         coalesce((upstream_usage#>>'{prompt_tokens_details,cache_write_5m_tokens}')::bigint,0) AS writes_5m,
         coalesce((upstream_usage#>>'{server_tool_use,web_search_requests}')::bigint,0) AS attempt_searches,
         coalesce((upstream_usage#>>'{server_tool_use,web_fetch_requests}')::bigint,0) AS attempt_fetches
       FROM observations
     ), tokens AS (
       SELECT coalesce(bool_or(price IS NULL),false) AS is_unpriced,
         coalesce(bool_and(prompt IS NOT NULL AND completion IS NOT NULL),true) AS has_token_usage,
         coalesce(bool_and(written=writes_1h+writes_5m),true) AS has_cache_detail,
         coalesce(sum(price),0) AS cost,coalesce(sum(prompt-cached-written),0)::bigint AS input_tokens,
         coalesce(sum(completion),0)::bigint AS output_tokens,coalesce(sum(cached),0)::bigint AS cached_tokens,
         coalesce(sum(writes_1h),0)::bigint AS writes_1h,coalesce(sum(writes_5m),0)::bigint AS writes_5m,
         coalesce(sum(attempt_searches),0)::bigint AS attempt_searches,
         coalesce(sum(attempt_fetches),0)::bigint AS attempt_fetches
       FROM attempts
     ), searches AS (
       SELECT count(*) AS requests FROM mechane.managed_web_searches WHERE workspace_id=s.workspace_id AND session_id=s.id AND at<boundary.through
         AND ($3::text IS NULL OR thread_id=$3)
     ), costs AS (
       SELECT tokens.*,seconds.active,seconds.thread_active,(searches.requests + tokens.attempt_searches) AS requests,
         tokens.attempt_fetches AS fetches,
         (3600 * tokens.cost + 36000000000000::numeric * (searches.requests + tokens.attempt_searches) +
         CASE WHEN $3::text IS NULL THEN seconds.active * 80000000000 ELSE 0 END) AS units
       FROM tokens,seconds,searches
     )
     SELECT is_unpriced,has_token_usage,has_cache_detail,trunc(units)::text AS consumed_units,round(units/36000000000000)::text AS list_cents,
       active::float8 AS active_seconds,thread_active::float8 AS thread_active_seconds,input_tokens,output_tokens,cached_tokens,writes_1h,writes_5m,
       requests AS search_count,fetches AS fetch_count FROM costs) billed
     WHERE s.workspace_id=$1 AND s.id=ANY($2::text[])`,
    [scope.workspaceId, scope.sessionIds, scope.threadId ?? null, scope.asOf ?? null],
  );

  return Schema.decodeUnknownSync(Schema.Array(Meter))(result.rows);
}

export async function managedUsageMeter(context: StoreContext, scope: ManagedUsageScope) {
  const meters = await usageMeters(context, { ...scope, sessionIds: [scope.sessionId] });
  const meter = meters[0];

  if (meter === undefined) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Session was not found');
  }

  return meter;
}

type UsageMeter = typeof Meter.Type;

function listCost(usage: UsageMeter) {
  if (usage.is_unpriced) {
    return null;
  }

  return { amount: usage.list_cents, currency: 'USD' } as const;
}

function cacheBreakdown(usage: UsageMeter) {
  if (usage.has_cache_detail) {
    return {
      cache_creation: { ephemeral_1h_input_tokens: usage.writes_1h, ephemeral_5m_input_tokens: usage.writes_5m },
    };
  }

  return {};
}

function tokenUsage(usage: UsageMeter) {
  if (!usage.has_token_usage) {
    return {};
  }

  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_input_tokens: usage.cached_tokens,
    ...cacheBreakdown(usage),
  };
}

function projectUsage(usage: UsageMeter, session: UsageMeter) {
  const reached =
    session.budget_cents !== null &&
    (session.is_unpriced || !exceedsConsumed(session.budget_cents, session.consumed_units));

  return {
    budget: managedBudget(session.budget_cents),
    reached,
    threadActiveSeconds: usage.thread_active_seconds,
    usage: {
      ...tokenUsage(usage),
      server_tool_use: { web_search_requests: usage.search_count, web_fetch_requests: usage.fetch_count },
      active_seconds: usage.active_seconds,
      list_cost: listCost(usage),
    },
  };
}

export function initialManagedSessionUsage(budgetCents: string | null) {
  return {
    budget: managedBudget(budgetCents),
    reached: false,
    threadActiveSeconds: 0,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
      server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
      active_seconds: 0,
      list_cost: { amount: '0', currency: 'USD' } as const,
    },
  };
}

export async function readManagedSessionUsage(context: StoreContext, scope: ManagedUsageScope) {
  const usage = await managedUsageMeter(context, scope);

  if (scope.threadId === undefined) {
    return projectUsage(usage, usage);
  }

  const { threadId: _threadId, ...sessionScope } = scope;
  const session = await managedUsageMeter(context, sessionScope);

  return projectUsage(usage, session);
}

export async function readManagedSessionUsages(context: StoreContext, scope: MultipleSessions) {
  const rows = await usageMeters(context, scope);

  return new Map(rows.map((row) => [row.id, projectUsage(row, row)]));
}
