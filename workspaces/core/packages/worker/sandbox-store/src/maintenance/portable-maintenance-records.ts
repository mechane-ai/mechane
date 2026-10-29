import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';
import { PortableMaintenance } from './schemas.ts';

const MaintenanceRow = Schema.Struct({ value: Schema.fromJsonString(PortableMaintenance) });

type PortableMaintenanceTable = {
  /** Absent before the first portable operation. */
  readonly portableMaintenance: () => Option.Option<PortableMaintenance>;
  readonly savePortableMaintenance: (input: PortableMaintenance) => void;
};

/** Keeps the portable operation journal separate from native provider maintenance during migration. */
export function portableMaintenanceRecords({ sql }: RecordsInput): PortableMaintenanceTable {
  const portableMaintenance: () => Option.Option<PortableMaintenance> = () => {
    const cursor = sql.exec('SELECT value FROM portable_maintenance WHERE slot = 1');
    const row = decodeFirst({ cursor, schema: MaintenanceRow });

    return Option.map(row, ({ value }) => value);
  };

  const savePortableMaintenance: (input: PortableMaintenance) => void = (input) => {
    const codec = Schema.fromJsonString(PortableMaintenance);
    const value = Schema.encodeSync(codec)(input);

    sql.exec(
      'INSERT INTO portable_maintenance (slot, value) VALUES (1, ?) ON CONFLICT (slot) DO UPDATE SET value = excluded.value',
      value,
    );
  };

  return { portableMaintenance, savePortableMaintenance };
}
