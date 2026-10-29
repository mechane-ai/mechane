import { RemoteSandboxId } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';

const RemoteSandbox = Schema.Struct({ id: RemoteSandboxId });

/** Reads the VM identity bound on first creation, absent before any provider VM is known. */
export function remoteSandbox({ sql }: RecordsInput): Option.Option<RemoteSandboxId> {
  const cursor = sql.exec('SELECT id FROM remote_sandbox WHERE slot = 1');
  const row = decodeFirst({ cursor, schema: RemoteSandbox });

  return Option.map(row, ({ id }) => id);
}
