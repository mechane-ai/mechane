import { Result } from 'effect';
import { RecoveryCheckpointRefused } from '../errors.ts';

type RecoveryRefusalInput = Pick<RecoveryCheckpointRefused, 'reason'>;

export function refuseRecoveryCheckpoint({ reason }: RecoveryRefusalInput): never {
  const cause = new RecoveryCheckpointRefused({ reason });
  const failure = Result.fail(cause);

  return Result.getOrThrow(failure);
}
