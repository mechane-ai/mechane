import { heartbeatConflict, managedId } from '@mechane/authority-store';
import type { StoreContext } from '@mechane/authority-store';
import { DEFAULT_LEASE_SECONDS, makeWorkSecret, presentWork } from './work-records.ts';
import type { WorkHeartbeat, WorkLocator, WorkPoll, WorkRow, WorkStop } from './work-records.ts';

type HeartbeatRow = Pick<WorkRow, 'state' | 'latest_heartbeat_at'> & {
  readonly can_extend: boolean;
  readonly ttl_seconds: number;
};

const TERMINAL_STATES: ReadonlySet<WorkRow['state']> = new Set(['stopping', 'stopped']);

export function createWorkClaims(context: StoreContext) {
  return {
    async poll(input: WorkPoll) {
      const credential = makeWorkSecret(input.origin);
      const leaseId = managedId('lease');

      const result = await context.client.query<WorkRow>(
        `WITH candidate AS (
           SELECT w.id FROM mechane.managed_work w WHERE w.workspace_id=$1 AND w.environment_id=$2
             AND mechane.workspace_allows_worker_effect(w.workspace_id,w.installation_owned)
             AND EXISTS(SELECT 1 FROM mechane.managed_sessions s WHERE s.workspace_id=w.workspace_id
               AND s.id=w.session_id AND s.status<>'terminated' AND s.archived_at IS NULL)
             AND NOT EXISTS(SELECT 1 FROM mechane.managed_work dirty WHERE dirty.workspace_id=w.workspace_id
               AND dirty.session_id=w.session_id AND dirty.effects_exposed
               AND (dirty.stopped_at IS NOT NULL OR dirty.lease_until<=clock_timestamp()))
             AND (
             (state='queued' AND (polled_at IS NULL OR polled_at<=now()-$3*interval '1 millisecond')) OR
             (state IN ('starting','active') AND lease_until<=clock_timestamp()))
           ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED)
         UPDATE mechane.managed_work w SET state='queued', polled_at=now(), token_hash=$4,
           acknowledged_at=NULL, started_at=NULL, latest_heartbeat_at=NULL,effects_exposed=false,lease_id=$6,lease_until=clock_timestamp()+$5*interval '1 second'
         FROM candidate WHERE w.id=candidate.id RETURNING w.*`,
        [
          input.workspaceId,
          input.environmentId,
          input.reclaimAfterMilliseconds,
          credential.digest,
          DEFAULT_LEASE_SECONDS,
          leaseId,
        ],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return presentWork(row, credential.secret);
    },
    async acknowledge(input: WorkLocator & { readonly tokenHash: string | null }) {
      const result = await context.client.query<WorkRow>(
        `UPDATE mechane.managed_work w SET
           state=CASE WHEN state='queued' THEN 'starting' ELSE state END,
           acknowledged_at=coalesce(acknowledged_at,now())
         WHERE workspace_id=$1 AND environment_id=$2 AND id=$3 AND polled_at IS NOT NULL
           AND state IN ('queued','starting','active') AND lease_until>clock_timestamp()
           AND ($4::text IS NULL OR token_hash=$4) AND mechane.workspace_allows_worker_effect(w.workspace_id,w.installation_owned)
         RETURNING *`,
        [input.workspaceId, input.environmentId, input.workId, input.tokenHash],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return presentWork(row);
    },
    async heartbeat(input: WorkHeartbeat) {
      return await context.atomic(async (transaction) => {
        const params = [input.workspaceId, input.environmentId, input.workId, input.tokenHash];
        const connection = transaction.client;

        const current = await connection.query<HeartbeatRow>(
          `SELECT state,latest_heartbeat_at,coalesce(lease_until>clock_timestamp(),false) AS can_extend,
             greatest(0,ceil(extract(epoch FROM lease_until-clock_timestamp())))::int AS ttl_seconds
           FROM mechane.managed_work WHERE workspace_id=$1 AND environment_id=$2 AND id=$3
             AND ($4::text IS NULL OR token_hash=$4) FOR UPDATE`,
          params,
        );

        const row = current.rows[0];

        if (row === undefined) {
          return { kind: 'missing' } as const;
        }

        const state = row.state;

        if (TERMINAL_STATES.has(state)) {
          return {
            kind: 'heartbeat',
            value: {
              type: 'work_heartbeat',
              last_heartbeat: row.latest_heartbeat_at ?? '',
              lease_extended: false,
              state: row.state,
              ttl_seconds: 0,
            },
          } as const;
        }

        if (!row.can_extend || row.state === 'queued') {
          return { kind: 'unavailable' } as const;
        }

        const expected = row.latest_heartbeat_at ?? 'NO_HEARTBEAT';

        if (input.expected !== null && input.expected !== expected) {
          const details = heartbeatConflict(row);

          return { kind: 'precondition', details } as const;
        }

        const update = await transaction.client.query<{ readonly latest_heartbeat_at: string }>(
          `UPDATE mechane.managed_work SET state='active', started_at=coalesce(started_at,now()),
            latest_heartbeat_at=greatest(date_trunc('milliseconds',clock_timestamp()),latest_heartbeat_at+interval '1 millisecond'),
            lease_until=clock_timestamp()+$2*interval '1 second' WHERE id=$1 AND lease_until>clock_timestamp() RETURNING latest_heartbeat_at`,
          [input.workId, input.ttlSeconds],
        );

        const next = update.rows[0];

        if (next === undefined) {
          return { kind: 'unavailable' } as const;
        }

        return {
          kind: 'heartbeat',
          value: {
            type: 'work_heartbeat',
            state: 'active',
            lease_extended: true,
            last_heartbeat: next.latest_heartbeat_at,
            ttl_seconds: input.ttlSeconds,
          },
        } as const;
      });
    },
    async stop(input: WorkStop) {
      const result = await context.client.query<WorkRow>(
        `UPDATE mechane.managed_work SET stop_requested_at=coalesce(stop_requested_at,now()),
           state=CASE WHEN $4 OR state IN ('queued','stopped') THEN 'stopped' ELSE 'stopping' END,
           stopped_at=CASE WHEN $4 OR state='queued' THEN coalesce(stopped_at,now()) ELSE stopped_at END
         WHERE workspace_id=$1 AND environment_id=$2 AND id=$3 AND ($5::text IS NULL OR token_hash=$5)
         RETURNING *`,
        [input.workspaceId, input.environmentId, input.workId, input.shouldForce, input.tokenHash],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return presentWork(row);
    },
  };
}
