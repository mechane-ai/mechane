import { MachineId, SandboxOperationId } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Result, Schema } from 'effect';

const MachineDrain = Schema.Struct({ machineId: MachineId, operationId: SandboxOperationId });
type MachineDrain = typeof MachineDrain.Type;
type MachineInput = Pick<MachineDrain, 'machineId'>;

class MachineDrainMissing extends Schema.TaggedError<MachineDrainMissing>()('MachineDrainMissing', {
  machineId: MachineId,
}) {}

type MachineDrains = {
  /** Absence means the machine has no pending graceful drain. */
  readonly machineDrain: (input: MachineInput) => Option.Option<MachineDrain>;
  readonly requestMachineDrain: (input: MachineInput) => MachineDrain;
  readonly clearMachineDrain: (input: MachineInput) => void;
};

/** A graceful stop keeps one checkpoint identity until that exact machine is stopped. */
export function machineDrains({ sql }: RecordsInput): MachineDrains {
  function machineDrain({ machineId }: MachineInput): Option.Option<MachineDrain> {
    const cursor = sql.exec(
      'SELECT machine_id AS machineId, operation_id AS operationId FROM machine_drains WHERE machine_id = ?',
      machineId,
    );

    return decodeFirst({ cursor, schema: MachineDrain });
  }

  function requestMachineDrain({ machineId }: MachineInput): MachineDrain {
    const operationId = SandboxOperationId.make(crypto.randomUUID());

    sql.exec(
      'INSERT INTO machine_drains (machine_id, operation_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
      machineId,
      operationId,
    );

    const drain = machineDrain({ machineId });

    if (Option.isNone(drain)) {
      const cause = new MachineDrainMissing({ machineId });
      const failed = Result.fail(cause);

      return Result.getOrThrow(failed);
    }

    return drain.value;
  }

  function clearMachineDrain({ machineId }: MachineInput): void {
    sql.exec('DELETE FROM machine_drains WHERE machine_id = ?', machineId);
  }

  return { machineDrain, requestMachineDrain, clearMachineDrain };
}
