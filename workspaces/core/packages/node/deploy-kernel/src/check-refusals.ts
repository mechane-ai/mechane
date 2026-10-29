import { Effect } from 'effect';
import { DeployFailed } from './errors.ts';
import type { CheckRefusalsInput } from './types.ts';

/**
 * Fails a check that found any refusal, naming what it checked and every refusal it found, so one run reports all a
 * person must fix.
 */
export function checkRefusals({ step, subjects, refusals }: CheckRefusalsInput): Effect.Effect<void, DeployFailed> {
  const reasons = refusals.filter(({ isRefused }) => isRefused).map(({ reason }) => reason);

  if (reasons.length > 0) {
    return Effect.fail(new DeployFailed({ step, subjects, reason: reasons.join('; ') }));
  }

  return Effect.void;
}
