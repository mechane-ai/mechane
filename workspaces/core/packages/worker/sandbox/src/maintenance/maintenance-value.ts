import { Option, Result } from 'effect';
import { PortableMaintenanceRefused } from '../errors.ts';

type MaintenanceValueInput<Value> = {
  /** Absent when the phase prerequisite has not been recorded. */
  readonly value: Option.Option<Value>;
  readonly field: string;
};

/** Names a missing journal prerequisite instead of continuing with an incomplete candidate. */
export function maintenanceValue<Value>({ value, field }: MaintenanceValueInput<Value>): Value {
  if (Option.isSome(value)) {
    return value.value;
  }

  const cause = new PortableMaintenanceRefused({ reason: `maintenance requires ${field}` });
  const failure = Result.fail(cause);

  return Result.getOrThrow(failure);
}
