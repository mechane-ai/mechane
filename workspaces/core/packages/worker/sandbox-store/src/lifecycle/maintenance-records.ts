import type { RemoteSandboxId } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';
import { SandboxMaintenance } from './schemas.ts';

type ReplacementBinding = {
  /** None clears the binding after explicit deletion. */
  readonly sandboxId: Option.Option<RemoteSandboxId>;
};

const MaintenanceJson = Schema.fromJsonString(SandboxMaintenance);
const MaintenanceRow = Schema.Struct({ value: MaintenanceJson });
/** The methods exposing the sandbox maintenance journal. */
export type MaintenanceRecords = ReturnType<typeof maintenanceRecords>;

type MaintenanceTable = {
  /** None before the first maintenance operation. */
  readonly maintenance: () => Option.Option<SandboxMaintenance>;
  readonly saveMaintenance: (input: SandboxMaintenance) => void;
  readonly replaceRemoteSandbox: (input: ReplacementBinding) => void;
};

/** The journal survives Worker eviction, so every destructive effect follows its recorded intent. */
export function maintenanceRecords({ sql }: RecordsInput): MaintenanceTable {
  const maintenance: () => Option.Option<SandboxMaintenance> = () => {
    const cursor = sql.exec('SELECT value FROM sandbox_maintenance WHERE slot = 1');
    const row = decodeFirst({ cursor, schema: MaintenanceRow });

    return Option.map(row, ({ value }) => value);
  };

  const saveMaintenance: (input: SandboxMaintenance) => void = (input) => {
    const value = Schema.encodeSync(MaintenanceJson)(input);

    sql.exec(
      'INSERT INTO sandbox_maintenance (slot, value) VALUES (1, ?) ON CONFLICT (slot) DO UPDATE SET value = excluded.value',
      value,
    );
  };

  const replaceRemoteSandbox: (input: ReplacementBinding) => void = ({ sandboxId }) => {
    sql.exec('DELETE FROM remote_sandbox WHERE slot = 1');

    if (Option.isSome(sandboxId)) {
      sql.exec('INSERT INTO remote_sandbox (slot, id) VALUES (1, ?)', sandboxId.value);
    }
  };

  return { maintenance, saveMaintenance, replaceRemoteSandbox };
}
