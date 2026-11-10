import type { ChecksFailure, Finding, InheritedInput } from '@mechane/checks-kernel';
import { writeTextFile } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { recordQualification } from '../selection/qualification.ts';
import { GREEN_FINGERPRINT } from './constants.ts';
import { fingerprintLines } from './fingerprint-lines.ts';

/** Records the full check's fingerprint and guarantee evidence after its complete task graph passes. */
export const recordFingerprint = Effect.fn('recordFingerprint')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const lines = yield* fingerprintLines({ inherited });
  const text = lines.join('\n');

  yield* recordQualification({ inherited });
  yield* writeTextFile({ path: GREEN_FINGERPRINT, text: `${text}\n` });

  return [];
});
