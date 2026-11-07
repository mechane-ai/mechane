import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import type { Memory } from '../domain.ts';
import type { StoreContext } from './context.ts';
import { StoreConflict } from './errors.ts';
import { withRunMutation } from './run-mutations.ts';

const MemoryRow = Schema.Struct({
  workspace_id: Schema.String,
  mech_id: Schema.String,
  path: Schema.String,
  text: Schema.String,
  digest: Schema.String,
  version: Schema.Int,
  run_id: Schema.NullOr(Schema.String),
  updated_at: Schema.String,
});

type MechIdentity = { readonly workspaceId: string; readonly mechId: string };
type MemoryIdentity = MechIdentity & { readonly path: string };

type WriteMemoryInput = MemoryIdentity & {
  readonly text: string;
  readonly expectedVersion: number | null;
  readonly runId: string | null;
};

type DeleteMemoryInput = MemoryIdentity & { readonly expectedVersion: number; readonly runId?: string | null };

function readMemory(value: unknown): Memory {
  const row = Schema.decodeUnknownSync(MemoryRow)(value);

  return {
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    path: row.path,
    text: row.text,
    digest: row.digest,
    version: row.version,
    runId: row.run_id,
    updatedAt: row.updated_at,
  };
}

function validateExpectedVersion(expectedVersion: number | null): void {
  if (expectedVersion !== null && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) {
    throw new StoreConflict('Memory version must be a positive integer');
  }
}

export function createMemoryStore(context: StoreContext) {
  return {
    listMemories: async ({ workspaceId, mechId }: MechIdentity): Promise<ReadonlyArray<Memory>> => {
      const found = await context.client.query(
        'SELECT * FROM mechane.memories WHERE workspace_id=$1 AND mech_id=$2 AND deleted_at IS NULL ORDER BY path',
        [workspaceId, mechId],
      );

      return found.rows.map(readMemory);
    },
    getMemory: async ({ workspaceId, mechId, path }: MemoryIdentity): Promise<Memory | null> => {
      const found = await context.client.query(
        'SELECT * FROM mechane.memories WHERE workspace_id=$1 AND mech_id=$2 AND path=$3 AND deleted_at IS NULL',
        [workspaceId, mechId, path],
      );

      if (found.rows.length === 0) {
        return null;
      }

      return readMemory(found.rows[0]);
    },
    writeMemory: async (input: WriteMemoryInput): Promise<Memory | null> => {
      validateExpectedVersion(input.expectedVersion);

      const digest = createHash('sha256').update(input.text, 'utf8').digest('hex');

      return await withRunMutation({
        context,
        scope: input,
        mutation: async (transaction) => {
          if (input.expectedVersion === null) {
            const created = await transaction.client.query(
              `INSERT INTO mechane.memories(workspace_id,mech_id,path,text,digest,version,run_id)
           SELECT $1,$2,$3,$4,$5,1,$6 WHERE $6::uuid IS NULL OR EXISTS(
             SELECT 1 FROM mechane.runs WHERE id=$6 AND workspace_id=$1 AND mech_id=$2
           ) ON CONFLICT(mech_id,path) DO UPDATE
           SET text=excluded.text,digest=excluded.digest,version=memories.version+1,
               run_id=excluded.run_id,updated_at=now(),deleted_at=NULL
           WHERE memories.workspace_id=$1 AND memories.deleted_at IS NOT NULL RETURNING *`,
              [input.workspaceId, input.mechId, input.path, input.text, digest, input.runId],
            );

            if (created.rows.length === 0) {
              return null;
            }

            return readMemory(created.rows[0]);
          }

          const saved = await transaction.client.query(
            `UPDATE mechane.memories SET text=$4,digest=$5,version=version+1,run_id=$7,updated_at=now()
         WHERE workspace_id=$1 AND mech_id=$2 AND path=$3 AND version=$6 AND deleted_at IS NULL AND ($7::uuid IS NULL OR EXISTS(
           SELECT 1 FROM mechane.runs WHERE id=$7 AND workspace_id=$1 AND mech_id=$2
         )) RETURNING *`,
            [input.workspaceId, input.mechId, input.path, input.text, digest, input.expectedVersion, input.runId],
          );

          if (saved.rows.length === 0) {
            return null;
          }

          return readMemory(saved.rows[0]);
        },
      });
    },
    deleteMemory: async (input: DeleteMemoryInput): Promise<boolean> => {
      validateExpectedVersion(input.expectedVersion);

      const digest = createHash('sha256').update('', 'utf8').digest('hex');

      return await withRunMutation({
        context,
        scope: input,
        mutation: async (transaction) => {
          const deleted = await transaction.client.query(
            `UPDATE mechane.memories SET text='',digest=$5,version=version+1,deleted_at=now(),updated_at=now()
         WHERE workspace_id=$1 AND mech_id=$2 AND path=$3 AND version=$4 AND deleted_at IS NULL RETURNING path`,
            [input.workspaceId, input.mechId, input.path, input.expectedVersion, digest],
          );

          return deleted.rows.length > 0;
        },
      });
    },
  };
}
