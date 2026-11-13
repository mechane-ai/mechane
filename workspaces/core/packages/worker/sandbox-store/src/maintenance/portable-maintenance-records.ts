import { SandboxAction, SandboxPhase, SandboxRestoreResult } from '@mechane/sandbox-wire';
import { decodeFirst } from '@mechane/store';
import type { DatabaseFunctions, RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';
import { workspaceRestoreRecords } from '../workspaces/workspace-restore-records.ts';
import { PortableMaintenance } from './schemas.ts';

const MaintenanceRow = Schema.Struct({ value: Schema.fromJsonString(PortableMaintenance) });
type MaintenanceRecordsInput = RecordsInput & Pick<DatabaseFunctions, 'atomic'>;

type PortableMaintenanceTable = {
  /** Absent before the first portable operation. */
  readonly portableMaintenance: () => Option.Option<PortableMaintenance>;
  readonly savePortableMaintenance: (input: PortableMaintenance) => void;
};

/** Persists the workspace maintenance operation before any provider effect. */
export function portableMaintenanceRecords({ sql, atomic }: MaintenanceRecordsInput): PortableMaintenanceTable {
  const restores = workspaceRestoreRecords({ sql });

  const portableMaintenance: () => Option.Option<PortableMaintenance> = () => {
    const cursor = sql.exec('SELECT value FROM portable_maintenance WHERE slot = 1');
    const row = decodeFirst({ cursor, schema: MaintenanceRow });

    return Option.map(row, ({ value }) => value);
  };

  const savePortableMaintenance: (input: PortableMaintenance) => void = (input) => {
    const codec = Schema.fromJsonString(PortableMaintenance);
    const value = Schema.encodeSync(codec)(input);

    atomic({
      run: () => {
        sql.exec(
          'INSERT INTO portable_maintenance (slot, value) VALUES (1, ?) ON CONFLICT (slot) DO UPDATE SET value = excluded.value',
          value,
        );

        const isCanceled = input.action === SandboxAction.Cancel && input.phase === SandboxPhase.Done;

        if (input.phase !== SandboxPhase.Failed && !isCanceled) {
          return;
        }

        const retained = restores.workspaceRestore({ operationId: input.id });

        if (Option.isNone(retained) || !SandboxRestoreResult.guards.Pending(retained.value.result)) {
          return;
        }

        const reason = Option.getOrElse(input.lastError, () => 'The restore operation was canceled');

        const result = SandboxRestoreResult.cases.Failed.make({ operationId: input.id, reason });

        restores.finishWorkspaceRestore({ operationId: input.id, result });
      },
    });
  };

  return { portableMaintenance, savePortableMaintenance };
}
