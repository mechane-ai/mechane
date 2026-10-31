import { SandboxAction, SandboxArchive, SandboxPhase } from '@mechane/protocol';
import { RecordText, RemoteSandboxId, SandboxOperationId } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';

/** Historical native maintenance remains decodable so unfinished work cannot be silently discarded. */
const SandboxMaintenance = Schema.Struct({
  id: SandboxOperationId,
  action: Schema.Enum(SandboxAction),
  phase: Schema.Enum(SandboxPhase),
  image: RecordText,
  sourceId: RecordText,
  /** Null before a replacement VM is discovered. */
  targetId: Schema.OptionFromNullOr(RemoteSandboxId),
  /** Null before the source archive is complete. */
  archive: Schema.OptionFromNullOr(Schema.toType(SandboxArchive)),
  part: Schema.Int,
});

type SandboxMaintenance = typeof SandboxMaintenance.Type;

const MaintenanceJson = Schema.fromJsonString(SandboxMaintenance);
const MaintenanceRow = Schema.Struct({ value: MaintenanceJson });
/** The methods exposing the sandbox maintenance journal. */
export type MaintenanceRecords = ReturnType<typeof maintenanceRecords>;

type MaintenanceTable = {
  /** None before the first maintenance operation. */
  readonly maintenance: () => Option.Option<SandboxMaintenance>;
  readonly clearRemoteSandbox: () => void;
};

/** Reads the retired native journal and clears its remote binding only after verified portable import. */
export function maintenanceRecords({ sql }: RecordsInput): MaintenanceTable {
  const maintenance: () => Option.Option<SandboxMaintenance> = () => {
    const cursor = sql.exec('SELECT value FROM sandbox_maintenance WHERE slot = 1');
    const row = decodeFirst({ cursor, schema: MaintenanceRow });

    return Option.map(row, ({ value }) => value);
  };

  const clearRemoteSandbox: () => void = () => {
    sql.exec('DELETE FROM remote_sandbox WHERE slot = 1');
  };

  return { maintenance, clearRemoteSandbox };
}
