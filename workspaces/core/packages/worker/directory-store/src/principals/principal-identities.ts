import { BrowserIdentity } from '@mechane/records';
import { decodeRows } from '@mechane/store';
import type { SqlCall } from '@mechane/store';
import { Schema } from 'effect';
import type { IdentityKey, PrincipalInput } from '../inputs.types.ts';

const IdentityRow = Schema.Struct({
  provider: BrowserIdentity.fields.provider,
  subject: BrowserIdentity.fields.subject,
});

/** Admission follows each recorded provider subject independently of the principal's display name. */
export function principalIdentities({ sql, principalId }: SqlCall<PrincipalInput>): ReadonlyArray<IdentityKey> {
  const cursor = sql.exec('SELECT provider, subject FROM principal_identities WHERE principal_id = ?', principalId);

  return decodeRows({ cursor, schema: IdentityRow });
}
