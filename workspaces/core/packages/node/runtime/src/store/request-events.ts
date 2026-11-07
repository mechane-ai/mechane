import { Schema } from 'effect';
import type { RequestEvent, RequestKind, RequestWait } from '../domain.ts';
import type { StoreContext } from './context.ts';
import { RecordNotFound, StoreConflict } from './errors.ts';

const RequestKindSchema = Schema.Literals(['access', 'vend']);
const RequestResolutionSchema = Schema.Literals(['ready', 'denied', 'expired', 'cancelled']);
const ACTIVE_RUN_STATUSES: ReadonlySet<string> = new Set(['queued', 'running', 'waiting']);

const EventSchema = Schema.Struct({
  id: Schema.String,
  service_id: Schema.String,
  request_id: Schema.String,
  kind: RequestKindSchema,
  resolution: RequestResolutionSchema,
  approval_id: Schema.NullOr(Schema.String),
  occurred_at: Schema.String,
});

const WaitSchema = Schema.Struct({
  service_id: Schema.String,
  request_id: Schema.String,
  kind: RequestKindSchema,
  run_id: Schema.String,
  hook_token: Schema.String,
  service_identity: Schema.String,
  resolution: Schema.NullOr(RequestResolutionSchema),
  event_id: Schema.NullOr(Schema.String),
  delivered_at: Schema.NullOr(Schema.String),
  closed_at: Schema.NullOr(Schema.String),
});

const RunSchema = Schema.Struct({ status: Schema.String, cancel_requested_at: Schema.NullOr(Schema.String) });

type RequestIdentity = { readonly serviceId: string; readonly requestId: string; readonly kind: RequestKind };

type RegisterWait = RequestIdentity & {
  readonly runId: string;
  readonly hookToken: string;
  readonly serviceIdentity: string;
};

type DeliveredEvent = RequestIdentity & { readonly eventId: string };
type CloseWait = RequestIdentity & { readonly runId: string };
type ServiceIdentity = { readonly serviceId: string };
type LockedRequest = { readonly context: StoreContext; readonly identity: RequestIdentity };
type ReadWait = LockedRequest & { readonly isUndeliveredOnly: boolean };

function decodeWait(value: unknown): RequestWait {
  const row = Schema.decodeUnknownSync(WaitSchema)(value);

  return {
    serviceId: row.service_id,
    requestId: row.request_id,
    kind: row.kind,
    runId: row.run_id,
    hookToken: row.hook_token,
    serviceIdentity: row.service_identity,
    resolution: row.resolution,
    eventId: row.event_id,
    deliveredAt: row.delivered_at,
    closedAt: row.closed_at,
  };
}

async function lockRequest({ context, identity }: LockedRequest): Promise<void> {
  const key = JSON.stringify(['mechane.request', identity.serviceId, identity.kind, identity.requestId]);

  await context.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
}

async function readWait({ context, identity, isUndeliveredOnly }: ReadWait): Promise<RequestWait | null> {
  const found = await context.client.query(
    `
    SELECT w.service_id,w.request_id,w.kind,w.run_id,w.hook_token,w.service_identity,
           e.resolution,w.event_id,w.delivered_at,w.closed_at
    FROM mechane.request_waits w LEFT JOIN mechane.request_events e ON e.id=w.event_id
    JOIN mechane.runs r ON r.id=w.run_id
    WHERE w.service_id=$1 AND w.kind=$2 AND w.request_id=$3
      AND (NOT $4 OR (w.delivered_at IS NULL AND w.closed_at IS NULL AND r.status IN ('queued','running','waiting')
                     AND r.cancel_requested_at IS NULL))`,
    [identity.serviceId, identity.kind, identity.requestId, isUndeliveredOnly],
  );

  if (found.rows.length === 0) {
    return null;
  }

  return decodeWait(found.rows[0]);
}

async function linkRecordedEvent({ context, identity }: LockedRequest): Promise<void> {
  await context.client.query(
    `
    UPDATE mechane.request_waits w SET event_id=e.id
    FROM mechane.request_events e
    WHERE w.service_id=$1 AND w.kind=$2 AND w.request_id=$3
      AND e.service_id=w.service_id AND e.kind=w.kind AND e.request_id=w.request_id
      AND w.event_id IS NULL`,
    [identity.serviceId, identity.kind, identity.requestId],
  );
}

export function createRequestStore(context: StoreContext) {
  return {
    isRequestServiceConfigured: async ({ serviceId }: ServiceIdentity): Promise<boolean> => {
      const found = await context.client.query(
        `SELECT EXISTS(
          SELECT 1 FROM mechane.execution_access WHERE access->'requestService'->>'serviceId'=$1
        ) AS "isConfigured"`,
        [serviceId],
      );

      const row = Schema.decodeUnknownSync(Schema.Struct({ isConfigured: Schema.Boolean }))(found.rows[0]);

      return row.isConfigured;
    },
    registerRequestWait: (input: RegisterWait): Promise<RequestWait> =>
      context.atomic(async (transaction) => {
        await lockRequest({ context: transaction, identity: input });

        const existing = await readWait({ context: transaction, identity: input, isUndeliveredOnly: false });

        if (existing !== null) {
          if (
            existing.runId !== input.runId ||
            existing.hookToken !== input.hookToken ||
            existing.serviceIdentity !== input.serviceIdentity
          ) {
            throw new StoreConflict('External request wait ownership changed');
          }

          return existing;
        }

        const runs = await transaction.client.query(
          'SELECT status,cancel_requested_at FROM mechane.runs WHERE id=$1 FOR SHARE',
          [input.runId],
        );

        if (runs.rows.length === 0) {
          throw new RecordNotFound('External request run was not found');
        }

        const run = Schema.decodeUnknownSync(RunSchema)(runs.rows[0]);

        if (!ACTIVE_RUN_STATUSES.has(run.status) || run.cancel_requested_at !== null) {
          throw new StoreConflict('External request run is no longer active');
        }

        await transaction.client.query(
          `
          INSERT INTO mechane.request_waits(service_id,request_id,kind,run_id,hook_token,service_identity)
          VALUES($1,$2,$3,$4,$5,$6)`,
          [input.serviceId, input.requestId, input.kind, input.runId, input.hookToken, input.serviceIdentity],
        );
        await linkRecordedEvent({ context: transaction, identity: input });

        const wait = await readWait({ context: transaction, identity: input, isUndeliveredOnly: false });

        if (wait === null) {
          throw new RecordNotFound('External request wait was not saved');
        }

        return wait;
      }),
    recordRequestEvent: async (event: RequestEvent): Promise<RequestWait | null> => {
      const identity: RequestIdentity = {
        serviceId: event.serviceId,
        requestId: event.request.id,
        kind: event.request.kind,
      };

      const occurredAt = new Date(event.occurredAt).toISOString();

      return await context.atomic(async (transaction) => {
        await lockRequest({ context: transaction, identity });
        await transaction.client.query(
          `
          INSERT INTO mechane.request_events(id,service_id,request_id,kind,resolution,approval_id,occurred_at)
          VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [
            event.id,
            event.serviceId,
            event.request.id,
            event.request.kind,
            event.request.status,
            event.request.approvalId,
            occurredAt,
          ],
        );

        const found = await transaction.client.query(
          `
          SELECT id,service_id,request_id,kind,resolution,approval_id,occurred_at FROM mechane.request_events
          WHERE service_id=$1 AND kind=$2 AND request_id=$3`,
          [identity.serviceId, identity.kind, identity.requestId],
        );

        if (found.rows.length === 0) {
          throw new StoreConflict('External event identity is already in use');
        }

        const saved = Schema.decodeUnknownSync(EventSchema)(found.rows[0]);

        const hasSameDecision =
          saved.resolution === event.request.status && saved.approval_id === event.request.approvalId;

        const hasSameEvent = saved.id === event.id && saved.occurred_at === occurredAt;

        if (!hasSameDecision || !hasSameEvent) {
          throw new StoreConflict('External request decision changed');
        }

        await linkRecordedEvent({ context: transaction, identity });

        return await readWait({ context: transaction, identity, isUndeliveredOnly: true });
      });
    },
    getRequestWait: (identity: RequestIdentity): Promise<RequestWait | null> =>
      readWait({ context, identity, isUndeliveredOnly: false }),
    closeRequestWait: async (input: CloseWait): Promise<void> => {
      const closed = await context.client.query(
        `UPDATE mechane.request_waits SET closed_at=COALESCE(closed_at,now())
         WHERE service_id=$1 AND kind=$2 AND request_id=$3 AND run_id=$4 RETURNING request_id`,
        [input.serviceId, input.kind, input.requestId, input.runId],
      );

      if (closed.rows.length === 0) {
        throw new StoreConflict('External request wait does not belong to the run');
      }
    },
    markRequestEventDelivered: async (input: DeliveredEvent): Promise<void> => {
      const marked = await context.client.query(
        `
        UPDATE mechane.request_waits SET delivered_at=COALESCE(delivered_at,now())
        WHERE service_id=$1 AND kind=$2 AND request_id=$3 AND event_id=$4 RETURNING request_id`,
        [input.serviceId, input.kind, input.requestId, input.eventId],
      );

      if (marked.rows.length === 0) {
        throw new StoreConflict('External request event does not match its wait');
      }
    },
  };
}
