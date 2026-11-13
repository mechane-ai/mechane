import { Result } from 'effect';
import { PortableMaintenanceRefused } from '../errors.ts';

type RefuseInput = Pick<PortableMaintenanceRefused, 'reason'>;

export function refusePortableMaintenance({ reason }: RefuseInput): never {
  const cause = new PortableMaintenanceRefused({ reason });
  const failure = Result.fail(cause);

  return Result.getOrThrow(failure);
}
