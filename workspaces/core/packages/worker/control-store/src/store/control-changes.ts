import { RecordId } from '@mechane/records';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import type {
  ClaimControlChanges,
  ControlChange,
  ControlChangeDelivery,
  ControlChangeDeliveryIdentity,
  ControlChangeStore,
  FailedControlChange,
} from '../control-change.ts';
import type { StoreContext } from './context.ts';
import { StoreConflict } from './errors.ts';
import { StoredTimestamp } from './row-values.ts';

const MAXIMUM_CLAIM_ROWS = 100;
const MAXIMUM_LEASE_MILLISECONDS = 60_000;
const RETRY_BASE_MILLISECONDS = 1000;
const MAXIMUM_RETRY_MILLISECONDS = 60_000;
const MAXIMUM_RETRY_EXPONENT = 6;

const ChangeRow = Schema.Struct({
  id: RecordId,
  workspace_id: RecordId,
  mech_id: RecordId,
  kind: Schema.Literal('control.changed'),
  source_sequence: Schema.Number,
  definition_revision: Schema.Number,
  created_at: StoredTimestamp,
});

export type ControlChangeRecipients = {
  readonly mechId?: string;
  readonly connectionId?: string;
  readonly credentialReference?: string;
};

type QueueControlChanges = ControlChangeRecipients & { readonly context: StoreContext; readonly workspaceId: string };

// Callers hold the workspace lock so each actor sees sequences in control commit order.
export async function queueControlChanges({
  context,
  workspaceId,
  mechId,
  connectionId,
  credentialReference,
}: QueueControlChanges): Promise<void> {
  const result = await context.client.query(
    `INSERT INTO mechane.control_changes(id,workspace_id,mech_id,kind,definition_revision)
     SELECT gen_random_uuid(),mech.workspace_id,mech.id,'control.changed',mech.revision FROM mechane.mechs mech
     WHERE mech.workspace_id=$1 AND ($2::uuid IS NULL OR mech.id=$2)
       AND ($3::uuid IS NULL OR EXISTS (
         SELECT 1 FROM mechane.mcp_grants grant_row WHERE grant_row.workspace_id=mech.workspace_id
           AND grant_row.mech_id=mech.id AND grant_row.connection_id=$3))
       AND ($4::text IS NULL OR EXISTS (
         SELECT 1 FROM mechane.mcp_grants grant_row JOIN mechane.mcp_connections connection
           ON connection.workspace_id=grant_row.workspace_id AND connection.id=grant_row.connection_id
         WHERE grant_row.workspace_id=mech.workspace_id AND grant_row.mech_id=mech.id
           AND connection.secret_reference=$4)) RETURNING *`,
    [workspaceId, mechId ?? null, connectionId ?? null, credentialReference ?? null],
  );

  context.recordControlChanges(result.rows.map(controlChange));
}

function controlChange(value: unknown): ControlChange {
  const row = Schema.decodeUnknownSync(ChangeRow)(value);

  const change = {
    id: row.id,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    kind: row.kind,
    sourceSequence: row.source_sequence,
    definitionRevision: row.definition_revision,
    createdAt: row.created_at,
  };

  const payloadDigest = createHash('sha256').update(JSON.stringify(change)).digest('hex');

  return { ...change, payloadDigest };
}

function validateClaim(input: ClaimControlChanges): void {
  const hasValidRows = Number.isSafeInteger(input.maxRows) && input.maxRows > 0 && input.maxRows <= MAXIMUM_CLAIM_ROWS;

  const hasValidLease =
    Number.isSafeInteger(input.leaseMilliseconds) &&
    input.leaseMilliseconds > 0 &&
    input.leaseMilliseconds <= MAXIMUM_LEASE_MILLISECONDS;

  if (!hasValidRows || !hasValidLease) {
    throw new StoreConflict('Control delivery claim exceeds its bounds');
  }
}

export function createControlChangeStore(context: StoreContext): ControlChangeStore {
  return {
    async readControlChangeDelivery(input: ControlChangeDeliveryIdentity): Promise<ControlChangeDelivery | null> {
      const result = await context.client.query('SELECT * FROM mechane.control_changes WHERE id=$1', [input.id]);
      const row: unknown = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return controlChangeDelivery(row, input);
    },
    async acknowledgeControlChangeDelivery(input: ControlChangeDeliveryIdentity): Promise<boolean> {
      return await context.atomic(async (transaction) => {
        const result = await transaction.client.query('SELECT * FROM mechane.control_changes WHERE id=$1 FOR UPDATE', [
          input.id,
        ]);

        const row: unknown = result.rows[0];

        if (row === undefined) {
          return false;
        }

        controlChangeDelivery(row, input);

        await transaction.client.query(
          'UPDATE mechane.control_changes SET delivered_at=COALESCE(delivered_at,now()),last_error=NULL WHERE id=$1',
          [input.id],
        );

        return true;
      });
    },
    async claimControlChanges(input: ClaimControlChanges): Promise<ReadonlyArray<ControlChange>> {
      validateClaim(input);

      const result = await context.client.query(
        `WITH selected AS (
           SELECT id FROM mechane.control_changes WHERE delivered_at IS NULL
             AND ((claim_id=$1 AND lease_until>now()) OR
               (next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<=now())))
           ORDER BY CASE WHEN claim_id=$1 THEN 0 ELSE 1 END,source_sequence
           FOR UPDATE SKIP LOCKED LIMIT $2
         ) UPDATE mechane.control_changes changes SET claim_id=$1,
           lease_until=now()+($3::double precision * interval '1 millisecond'),attempt_count=attempt_count+1
         FROM selected WHERE changes.id=selected.id RETURNING changes.*`,
        [input.claimId, input.maxRows, input.leaseMilliseconds],
      );

      return result.rows.map(controlChange);
    },
    async failControlChange({ id, claimId, reason }: FailedControlChange): Promise<boolean> {
      const result = await context.client.query(
        `UPDATE mechane.control_changes SET claim_id=NULL,lease_until=NULL,last_error=$3,
           next_attempt_at=now()+(LEAST($4::double precision * power(2,LEAST(attempt_count-1,$5)),$6) * interval '1 millisecond')
         WHERE id=$1 AND claim_id=$2 AND delivered_at IS NULL RETURNING id`,
        [id, claimId, reason, RETRY_BASE_MILLISECONDS, MAXIMUM_RETRY_EXPONENT, MAXIMUM_RETRY_MILLISECONDS],
      );

      return result.rows.length > 0;
    },
  };
}

function controlChangeDelivery(row: unknown, input: ControlChangeDeliveryIdentity): ControlChangeDelivery {
  const change = controlChange(row);

  if (change.payloadDigest !== input.payloadDigest) {
    throw new StoreConflict('The control delivery differs from its immutable record');
  }

  const delivered = Schema.decodeUnknownSync(Schema.Struct({ delivered_at: Schema.NullOr(StoredTimestamp) }))(row);

  return { change, isDelivered: delivered.delivered_at !== null };
}
