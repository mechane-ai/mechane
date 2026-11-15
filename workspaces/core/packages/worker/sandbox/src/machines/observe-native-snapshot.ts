import { captureBefore } from '@mechane/utilities';
import { Duration, Option, Result } from 'effect';
import type { MachineIdInput, ProviderStepInput } from '../types.ts';

const OBSERVATION_TIMEOUT = Duration.seconds(1);

/** Optional provider evidence cannot change startup, retirement, or committed file outcomes. */
export async function observeNativeSnapshot({
  store,
  provider,
  machineId,
}: ProviderStepInput & MachineIdInput): Promise<void> {
  const promise = provider.snapshotReport({ machineId });
  const observed = await captureBefore({ promise, span: OBSERVATION_TIMEOUT });

  if (Option.isNone(observed) || Result.isFailure(observed.value) || Option.isNone(observed.value.success)) {
    return;
  }

  const snapshot = observed.value.success.value;
  const saved = Result.try(() => store.observeNativeSnapshot({ snapshot }));

  Result.getOrElse(saved, () => undefined);
}
