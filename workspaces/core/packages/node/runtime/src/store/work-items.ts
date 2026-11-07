import { Schema } from 'effect';
import type { WorkItem } from '../domain.ts';
import type { StoreContext } from './context.ts';
import { StoreConflict } from './errors.ts';
import { withRunMutation } from './run-mutations.ts';

const WorkItemRow = Schema.Struct({
  id: Schema.String,
  workspace_id: Schema.String,
  mech_id: Schema.String,
  title: Schema.String,
  state: Schema.Literals(['open', 'resolved', 'abandoned']),
  note: Schema.NullOr(Schema.String),
  created_at: Schema.String,
  updated_at: Schema.String,
});

type MechIdentity = { readonly workspaceId: string; readonly mechId: string };

type UpsertWorkInput = MechIdentity & {
  readonly id: string;
  readonly title: string;
  readonly state: WorkItem['state'];
  readonly note: string | null;
  readonly runId?: string | null;
};

function readWorkItem(value: unknown): WorkItem {
  const row = Schema.decodeUnknownSync(WorkItemRow)(value);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    title: row.title,
    state: row.state,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkStore(context: StoreContext) {
  return {
    listWorkItems: async ({ workspaceId, mechId }: MechIdentity): Promise<ReadonlyArray<WorkItem>> => {
      const found = await context.client.query(
        'SELECT * FROM mechane.work_items WHERE workspace_id=$1 AND mech_id=$2 ORDER BY created_at,id',
        [workspaceId, mechId],
      );

      return found.rows.map(readWorkItem);
    },
    upsertWorkItem: async (input: UpsertWorkInput): Promise<WorkItem> =>
      await withRunMutation({
        context,
        scope: input,
        mutation: async (transaction) => {
          const saved = await transaction.client.query(
            `INSERT INTO mechane.work_items(id,workspace_id,mech_id,title,state,note)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title,state=excluded.state,note=excluded.note,updated_at=now()
         WHERE work_items.workspace_id=excluded.workspace_id AND work_items.mech_id=excluded.mech_id
         RETURNING *`,
            [input.id, input.workspaceId, input.mechId, input.title, input.state, input.note],
          );

          if (saved.rows.length === 0) {
            throw new StoreConflict('Work item belongs to another mech');
          }

          return readWorkItem(saved.rows[0]);
        },
      }),
  };
}
