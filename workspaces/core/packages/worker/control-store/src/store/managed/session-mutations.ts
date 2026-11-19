import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import type { StoreContext } from '../context.ts';
import { StoredChecksum } from '../row-values.ts';
import { ManagedStoreError } from './managed-record.ts';
import type { BudgetModelValidator } from './session-create.ts';
import { archiveSession, deleteSession, updateSession } from './session-lifecycle.ts';
import type { SessionIdentity } from './session-records.ts';
import type { ManagedDocument } from './types.ts';

export type MutationInput = SessionIdentity & {
  readonly kind: 'update' | 'archive' | 'delete';
  readonly mutationId: string;
  readonly changes?: ManagedDocument;
  readonly forwardMetadata: ReadonlyArray<string>;
  readonly validateBudgetModels?: BudgetModelValidator;
};

const StoredReceipt = Schema.Struct({
  fingerprint: StoredChecksum,
  result: Schema.Record(Schema.String, Schema.Unknown),
});

export async function applySessionMutation(transaction: StoreContext, input: MutationInput) {
  const { scope, id, mutationId, kind, changes = {} } = input;
  const values = [scope.workspaceId, id, mutationId, scope.principalId];

  // A delete removes the row that would otherwise serialize receipt creation.
  await transaction.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [id]);

  const found = await transaction.client.query(
    'SELECT fingerprint,result FROM mechane.managed_session_mutations WHERE workspace_id=$1 AND session_id=$2 AND mutation_id=$3 AND principal_id=$4',
    values,
  );

  const canonical = await transaction.client.query<{ readonly body: string }>('SELECT $1::jsonb::text AS body', [
    JSON.stringify({ kind, changes }),
  ]);

  const body = canonical.rows[0];

  if (body === undefined) {
    throw new Error('Missing mutation fingerprint');
  }

  const fingerprint = createHash('sha256').update(body.body).digest('hex');

  if (found.rows.length > 0) {
    const receipt = Schema.decodeUnknownSync(StoredReceipt)(found.rows[0]);

    if (receipt.fingerprint !== fingerprint) {
      throw new ManagedStoreError(HttpStatusCode.Conflict, 'Session mutation changed across retries');
    }

    return { applied: false, document: receipt.result };
  }

  async function apply() {
    switch (kind) {
      case 'update':
        return await updateSession(transaction, { ...input, changes });
      case 'archive':
        return await archiveSession(transaction, input);
      case 'delete':
        return await deleteSession(transaction, input);
    }
  }

  const document = await apply();

  if (kind === 'delete') {
    await transaction.client.query(
      'DELETE FROM mechane.managed_session_mutations WHERE workspace_id=$1 AND session_id=$2',
      [scope.workspaceId, id],
    );
  }

  await transaction.client.query(
    'INSERT INTO mechane.managed_session_mutations(workspace_id,session_id,mutation_id,principal_id,fingerprint,result) VALUES($1,$2,$3,$4,$5,$6)',
    [...values, fingerprint, JSON.stringify(document)],
  );

  return { applied: true, document };
}
