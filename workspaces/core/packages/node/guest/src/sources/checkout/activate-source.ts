import type { SourceId } from '@mechane/records';
import { Effect } from 'effect';
import { lstat, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { SourceGuestFailed } from '../../errors.ts';
import type { GuestSettings } from '../../types.ts';
import { PRIVATE_DIRECTORY_MODE } from './constants.ts';
import { sourceStagingPath } from './source-staging-path.ts';

/** The checkout generation and destination owned by the current source lease. */
type SourceFilesInput = {
  readonly settings: GuestSettings;
  readonly sourceId: SourceId;
  readonly generation: SourceId;
};

/** Moves only the completed staging directory into an unused source destination. */
export const activateSource = Effect.fn('activateSource')(function* ({
  settings,
  sourceId,
  generation,
}: SourceFilesInput): Effect.fn.Return<void, SourceGuestFailed> {
  const parent = join(settings.home, 'sources');

  yield* Effect.tryPromise({
    try: () => mkdir(parent, { recursive: true, mode: PRIVATE_DIRECTORY_MODE }),
    catch: () => new SourceGuestFailed({ sourceId, reason: 'source parent directory is unavailable' }),
  });

  const stat = yield* Effect.tryPromise({
    try: () => lstat(parent),
    catch: () => new SourceGuestFailed({ sourceId, reason: 'source parent directory is unavailable' }),
  });

  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'source parent is not a regular directory' });
  }

  const destination = join(parent, sourceId);

  yield* Effect.tryPromise({
    try: () => mkdir(destination),
    catch: () => new SourceGuestFailed({ sourceId, reason: 'source destination already exists or is unavailable' }),
  });

  const staging = sourceStagingPath({ home: settings.home, generation });

  yield* Effect.tryPromise({
    try: () => rename(staging, destination),
    catch: () => new SourceGuestFailed({ sourceId, reason: 'source checkout could not be activated' }),
  });
});
