import { decodeFirst } from '@mechane/store';
import type { SqlCall } from '@mechane/store';
import type { Option } from 'effect';
import type { PrincipalInput } from '../inputs.types.ts';
import { PrincipalRow } from '../schemas.ts';

/** Caller-supplied principal IDs may be absent; owned references use the same lookup with an invariant guard. */
export function findPrincipal({ sql, principalId }: SqlCall<PrincipalInput>): Option.Option<PrincipalRow> {
  const cursor = sql.exec('SELECT id, name FROM principals WHERE id = ?', principalId);

  return decodeFirst({ cursor, schema: PrincipalRow });
}
