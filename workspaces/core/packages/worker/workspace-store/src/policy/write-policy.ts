import type { WorkspacePolicy } from '@mechane/protocol';
import type { SqlCall } from '@mechane/store';
import { Schema } from 'effect';
import { PolicyRow } from './schemas.ts';

type WritePolicyInput = { readonly policy: WorkspacePolicy };

/** Only explicit policy mutations replace this document; deployment defaults are never written here. */
export function writePolicy({ sql, policy }: SqlCall<WritePolicyInput>): void {
  const serialized = Schema.encodeSync(PolicyRow.fields.policy)(policy);

  sql.exec(
    'INSERT INTO workspace_policy (singleton, policy) VALUES (1, ?) ON CONFLICT (singleton) DO UPDATE SET policy = excluded.policy',
    serialized,
  );
}
