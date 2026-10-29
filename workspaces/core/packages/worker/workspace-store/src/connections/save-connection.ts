import type { SqlCall } from '@mechane/store';
import { Schema } from 'effect';
import { ConnectionRow } from './schemas.ts';
import type { SaveConnectionInput } from './types.ts';

type EncodedConnectionInput = { readonly fields: typeof ConnectionRow.Encoded };
type InsertConnectionInput = SqlCall<EncodedConnectionInput>;

/** Persists references only; credential resolution belongs to the trusted invocation path. */
export function saveConnection({
  sql,
  connectionId,
  configuration,
  isCreating,
  now,
}: SqlCall<SaveConnectionInput>): void {
  const fields = Schema.encodeSync(ConnectionRow)({
    ...configuration,
    id: connectionId,
    createdAt: now,
    updatedAt: now,
  });

  if (isCreating) {
    insertConnection({ sql, fields });

    return;
  }

  sql.exec(
    'UPDATE remote_connections SET name = ?, url = ?, secret_reference = ?, allowed_tools = ?, policy = ?, updated_at_ms = ? WHERE id = ?',
    fields.name,
    fields.url,
    fields.secret_reference,
    fields.allowed_tools,
    fields.policy,
    fields.updated_at_ms,
    connectionId,
  );
}

function insertConnection({ sql, fields }: InsertConnectionInput): void {
  sql.exec(
    'INSERT INTO remote_connections (id, name, url, secret_reference, allowed_tools, policy, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    fields.id,
    fields.name,
    fields.url,
    fields.secret_reference,
    fields.allowed_tools,
    fields.policy,
    fields.created_at_ms,
    fields.updated_at_ms,
  );
}
