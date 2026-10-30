import type { WorkspacePolicy } from '@mechane/protocol';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option } from 'effect';
import { PolicyRow } from './schemas.ts';

/** An absent policy stays absent so the caller can apply installation defaults without persisting them. */
export function readPolicy({ sql }: RecordsInput): Option.Option<WorkspacePolicy> {
  const cursor = sql.exec('SELECT policy FROM workspace_policy WHERE singleton = 1');
  const row = decodeFirst({ cursor, schema: PolicyRow });

  return Option.map(row, ({ policy }) => policy);
}
