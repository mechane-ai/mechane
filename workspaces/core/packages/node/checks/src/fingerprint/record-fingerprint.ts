import type { ChecksFailure, Finding, InheritedInput } from '@mechane/checks-kernel';
import { writeTextFile } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { GREEN_FINGERPRINT } from './constants.ts';
import { fingerprintLines } from './fingerprint-lines.ts';

/** Records the full check's behavior fingerprint after its complete task graph passes. */
export const recordFingerprint = Effect.fn('recordFingerprint')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const lines = yield* fingerprintLines({ inherited });
  const text = lines.join('\n');

  yield* writeTextFile({ path: GREEN_FINGERPRINT, text: `${text}\n` });

  return [];
});
