import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { StoreContext } from '../context.ts';
import { poolContext } from '../context.ts';
import { openPool } from '../postgres.ts';
import { ManagedStoreError } from './managed-record.ts';
import { digestWorkToken } from './work-records.ts';

type BeginTransfer = {
  readonly workspaceId: string;
  readonly workId: string;
  readonly token: string;
  readonly maxConcurrentRequests: number;
  readonly maxSessionBytes: number;
};

type Transfer = { readonly id: string };
type TransferBytes = Transfer & { readonly bytes: number };

const IDLE_LEASE_SECONDS = 300;
const Claim = Schema.Struct({ isExhausted: Schema.Boolean });
const Charge = Schema.Struct({ isActive: Schema.Boolean, isCharged: Schema.Boolean });

function exhausted(): ManagedStoreError {
  return new ManagedStoreError(HttpStatusCode.Forbidden, 'The Git transfer allowance for this work item is exhausted');
}

function expired(): ManagedStoreError {
  return new ManagedStoreError(HttpStatusCode.Forbidden, 'The Git transfer lease is no longer active');
}

function createGitTransferStore(context: StoreContext) {
  async function begin(input: BeginTransfer): Promise<string> {
    const digest = digestWorkToken(input.token);
    const id = randomUUID();

    return await context.atomic(async (transaction) => {
      await transaction.client.query("SELECT pg_advisory_xact_lock(hashtext('mechane-managed-git-capacity'))");

      const claim = await transaction.client.query(
        `UPDATE mechane.managed_work w SET git_claim_hash=$3,
            git_transferred_bytes=CASE WHEN git_claim_hash=$3 THEN git_transferred_bytes ELSE 0 END
         WHERE id=$1 AND workspace_id=$2 AND token_hash=$3
           AND state IN ('active','starting') AND lease_until>clock_timestamp() AND mechane.workspace_allows_worker_effect(w.workspace_id,w.installation_owned)
         RETURNING ($4::bigint>0 AND git_transferred_bytes>=$4::bigint) AS "isExhausted"`,
        [input.workId, input.workspaceId, digest, input.maxSessionBytes],
      );

      if (claim.rowCount !== 1) {
        throw expired();
      }

      const applied = Schema.decodeUnknownSync(Claim)(claim.rows[0]);

      if (applied.isExhausted) {
        throw exhausted();
      }

      await transaction.client.query(`DELETE FROM mechane.managed_git_transfers t WHERE t.expires_at<=clock_timestamp()
        OR NOT EXISTS (SELECT 1 FROM mechane.managed_work w WHERE w.id=t.work_id AND w.token_hash=t.claim_hash
          AND w.state IN ('active','starting') AND w.lease_until>clock_timestamp())`);

      const admitted = await transaction.client.query(
        `INSERT INTO mechane.managed_git_transfers(id,work_id,claim_hash,maximum_bytes,expires_at)
           SELECT $1,$2,$3,$4,clock_timestamp()+$5*interval '1 second'
           WHERE (SELECT count(*) FROM mechane.managed_git_transfers)<$6`,
        [id, input.workId, digest, input.maxSessionBytes, IDLE_LEASE_SECONDS, input.maxConcurrentRequests],
      );

      if (admitted.rowCount !== 1) {
        throw new ManagedStoreError(HttpStatusCode.TooManyRequests, 'All Git transfer slots are in use');
      }

      return id;
    });
  }

  async function consume({ id, bytes }: TransferBytes): Promise<void> {
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new Error('Git transfer byte count is invalid');
    }

    const result = await context.client.query(
      `WITH active AS MATERIALIZED (
         SELECT w.id AS work_id,t.maximum_bytes FROM mechane.managed_work w
         JOIN mechane.managed_git_transfers t ON t.work_id=w.id AND t.claim_hash=w.token_hash
         WHERE t.id=$1 AND t.expires_at>clock_timestamp() AND w.lease_until>clock_timestamp()
           AND w.state IN ('active','starting') AND mechane.workspace_allows_worker_effect(w.workspace_id,w.installation_owned) FOR UPDATE OF w,t
       ), charged AS (
         UPDATE mechane.managed_work w SET git_transferred_bytes=w.git_transferred_bytes+$2::bigint
         FROM active WHERE w.id=active.work_id AND (active.maximum_bytes=0
           OR w.git_transferred_bytes<=active.maximum_bytes-$2::bigint) RETURNING w.id
       ), renewed AS (
         UPDATE mechane.managed_git_transfers t SET expires_at=clock_timestamp()+$3*interval '1 second'
         FROM charged WHERE t.id=$1 AND t.work_id=charged.id RETURNING t.id
       ) SELECT EXISTS (SELECT FROM active) AS "isActive", EXISTS (SELECT FROM renewed) AS "isCharged"`,
      [id, bytes, IDLE_LEASE_SECONDS],
    );

    const charge = Schema.decodeUnknownSync(Charge)(result.rows[0]);

    if (!charge.isActive) {
      throw expired();
    }

    if (!charge.isCharged) {
      throw exhausted();
    }
  }

  async function release({ id }: Transfer): Promise<void> {
    await context.client.query('DELETE FROM mechane.managed_git_transfers WHERE id=$1', [id]);
  }

  return { begin, consume, release };
}

type OpenTransfer = BeginTransfer & { readonly databaseUrl: string };

export async function openGitTransfer({ databaseUrl, ...limits }: OpenTransfer) {
  const pool = openPool({ databaseUrl, maxConnections: 1 });
  const context = poolContext(pool);
  const store = createGitTransferStore(context);

  try {
    const id = await store.begin(limits);

    return {
      consume: async (bytes: number) => await store.consume({ id, bytes }),
      close: async () => {
        try {
          await store.release({ id });
        } finally {
          await pool.end();
        }
      },
    };
  } catch (error) {
    await pool.end();

    throw error;
  }
}
