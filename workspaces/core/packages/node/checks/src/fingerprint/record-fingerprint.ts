import type { ChecksFailure, Finding, InheritedInput } from '@mechane/checks-kernel';
import { writeTextFile } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { GREEN_FINGERPRINT } from './constants.ts';
import { fingerprintLines } from './fingerprint-lines.ts';

/** Records the fingerprint as the last green full check's, which `compare` reads; it reports no findings. */
export const recordFingerprint = Effect.fn('recordFingerprint')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const lines = yield* fingerprintLines({ inherited });

  yield* writeTextFile({ path: GREEN_FINGERPRINT, text: `${lines.join('\n')}\n` });

  return [];
});
