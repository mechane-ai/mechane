import { writeResult } from '@mechane/program';
import { Effect } from 'effect';
import { buildSourceRelease } from './build/build-source-release.ts';
import type { ReleaseFailed } from './errors.ts';
import type { InheritedInput } from './types.ts';

/** Builds the release this source declares into the release folder and prints its manifest. */
export const printSourceRelease = Effect.fn('printSourceRelease')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<void, ReleaseFailed> {
  const { text } = yield* buildSourceRelease({ inherited });

  writeResult({ line: text });
});
