import { Schema } from 'effect';
import type { ActivityEvent } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { StoreConflict } from '../errors.ts';
import { advanceRunVersion } from '../run-version.ts';

type AppendActivityInput = Omit<ActivityEvent, 'sequence' | 'createdAt'>;

const ActivitySchema = Schema.Struct({
  id: Schema.String,
  sequence: Schema.Number,
  workspace_id: Schema.String,
  mech_id: Schema.String,
  run_id: Schema.NullOr(Schema.String),
  type: Schema.String,
  payload: Schema.Record(Schema.String, Schema.Unknown),
  created_at: Schema.String,
});

function activity(value: unknown): ActivityEvent {
  const row = Schema.decodeUnknownSync(ActivitySchema)(value);

  return {
    id: row.id,
    sequence: row.sequence,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    runId: row.run_id,
    type: row.type,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

export function createActivityStore(context: StoreContext) {
  return {
    appendActivity: async (input: AppendActivityInput): Promise<ActivityEvent> =>
      await context.atomic(async (transaction) => {
        const inserted = await transaction.client.query(
          `
        INSERT INTO mechane.activity(id,workspace_id,mech_id,run_id,type,data)
        SELECT $1,$2,$3,$4,$5,$6 WHERE $4::uuid IS NULL OR EXISTS(
          SELECT 1 FROM mechane.runs WHERE id=$4 AND workspace_id=$2 AND mech_id=$3)
        ON CONFLICT(id) DO NOTHING
        RETURNING id,sequence,workspace_id,mech_id,run_id,type,data AS payload,created_at`,
          [input.id, input.workspaceId, input.mechId, input.runId, input.type, input.payload],
        );

        if (inserted.rows.length > 0) {
          if (input.runId !== null) {
            await advanceRunVersion({ client: transaction.client, runId: input.runId });
          }

          return activity(inserted.rows[0]);
        }

        const existing = await transaction.client.query(
          `
        SELECT id,sequence,workspace_id,mech_id,run_id,type,data AS payload,created_at FROM mechane.activity WHERE id=$1`,
          [input.id],
        );

        if (existing.rows.length === 0) {
          throw new StoreConflict('Activity run was not found');
        }

        const prior = activity(existing.rows[0]);

        const hasSameOwner = prior.workspaceId === input.workspaceId && prior.mechId === input.mechId;
        const hasSameEvent = prior.runId === input.runId && prior.type === input.type;

        if (!hasSameOwner || !hasSameEvent) {
          throw new StoreConflict('Activity identity changed');
        }

        return prior;
      }),
  };
}
