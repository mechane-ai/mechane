import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';
import { MachineIdRow } from '../schemas.ts';
import type { MachineTimeInput } from '../types.ts';

const RemoteGuest = Schema.Struct({ id: Schema.OptionFromNullOr(MachineIdRow.fields.id) });

/** Reads the last guest started on the persistent VM, absent before its first guest starts. */
export function remoteGuest({ sql }: RecordsInput): Option.Option<MachineTimeInput['machineId']> {
  const cursor = sql.exec('SELECT guest_machine_id AS id FROM remote_sandbox WHERE slot = 1');
  const row = decodeFirst({ cursor, schema: RemoteGuest });

  return Option.flatMap(row, ({ id }) => id);
}
