import { ReleaseStampMissing } from '@mechane/cli-kernel';
import type { ReleasedBinary, UpdateFailure, UpdateResult } from '@mechane/cli-kernel';
import { latestRelease } from '@mechane/client';
import type { ClientFailure } from '@mechane/client';
import { UpdateOutcome } from '@mechane/program';
import { installScriptUrl } from '@mechane/protocol';
import type { Release } from '@mechane/protocol';
import type { Duration } from 'effect';
import { Effect, Option } from 'effect';
import { installRelease } from './install-release.ts';

/** The running program, the deployment whose latest release replaces it, and whether only a report is asked for. */
type UpdateReleaseInput = {
  readonly origin: URL;
  readonly release: Release;
  /** None for a program no release compiled, such as a run from source. */
  readonly binary: Option.Option<ReleasedBinary>;
  readonly userAgent: string;
  readonly timeout: Duration.Duration;
  readonly isCheckOnly: boolean;
};

/**
 * Replaces a release's binary with the latest release its deployment publishes, unless it runs that release already or
 * only a report is asked for. A program no release compiled refuses before it asks the deployment anything.
 */
export const updateRelease = Effect.fn('updateRelease')(function* ({
  origin,
  release,
  binary,
  userAgent,
  timeout,
  isCheckOnly,
}: UpdateReleaseInput): Effect.fn.Return<UpdateResult, UpdateFailure | ClientFailure> {
  if (Option.isNone(binary)) {
    const installerUrl = installScriptUrl({ origin });

    return yield* new ReleaseStampMissing({ release, installScriptUrl: installerUrl });
  }

  const latest = yield* latestRelease({ origin, timeout, userAgent });
  const found = { from: release, to: latest.release, binary: binary.value.path };

  if (latest.release === release) {
    return { ...found, outcome: UpdateOutcome.UpToDate };
  }

  if (isCheckOnly) {
    return { ...found, outcome: UpdateOutcome.Available };
  }

  yield* installRelease({ origin, latest, binary: binary.value, userAgent });

  return { ...found, outcome: UpdateOutcome.Updated };
});
