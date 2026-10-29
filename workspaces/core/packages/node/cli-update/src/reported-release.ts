import { BinaryMismatched, BinaryUnrunnable, ReleaseMisreported } from '@mechane/cli-kernel';
import type { BinaryMismatch } from '@mechane/cli-kernel';
import { PROGRAM, VERSION_COMMAND } from '@mechane/commands';
import type { Release } from '@mechane/protocol';
import { Duration, Effect } from 'effect';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/** How long a new binary may take to report its release before the update refuses it. */
const VERSION_TIMEOUT = Duration.seconds(10);

/** The new binary, the URL it came from, and the release it must report. */
type ReportedReleaseInput = { readonly path: string; readonly url: URL; readonly release: Release };

/** Runs a file with arguments and answers what it wrote, as `execFile` does. */
const execute = promisify(execFile);

/**
 * Runs the new binary at `path` as `mechane version`, which must report `release`. The digest proves the bytes are the
 * manifest's, not that they run on this machine, and a binary that does not run could never update itself again.
 */
export const reportedRelease = Effect.fn('reportedRelease')(function* ({
  path,
  url,
  release,
}: ReportedReleaseInput): Effect.fn.Return<void, BinaryMismatched> {
  const expected = `${PROGRAM} ${release}`;
  const options = { timeout: Duration.toMillis(VERSION_TIMEOUT) };

  const mismatched: (mismatch: BinaryMismatch) => BinaryMismatched = (mismatch) =>
    new BinaryMismatched({ url, mismatch });

  const { stdout } = yield* Effect.tryPromise({
    try: () => execute(path, [VERSION_COMMAND], options),
    catch: (cause) => new BinaryUnrunnable({ reason: String(cause) }),
  }).pipe(Effect.mapError(mismatched));

  const reported = stdout.trim();

  if (reported !== expected) {
    return yield* new BinaryMismatched({ url, mismatch: new ReleaseMisreported({ release, reported }) });
  }
});
