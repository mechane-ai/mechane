import { Effect } from 'effect';
import type { ReleaseFailed } from './errors.ts';
import { loadReleaseSettings } from './load-release-settings.ts';
import { printSourceRelease } from './print-source-release.ts';

/** Loads release CLI settings and executes the requested source release mode. */
export const runMode = Effect.fn('runMode')(function* (): Effect.fn.Return<void, ReleaseFailed> {
  const { inherited } = yield* loadReleaseSettings();

  return yield* printSourceRelease({ inherited });
});
