import { RELEASE } from '@mechane/protocol';
import type { ReleaseFailed } from '@mechane/release';
import { buildRelease, hostTarget } from '@mechane/release';
import { Effect } from 'effect';
import { join } from 'node:path';
import type { StackFailed } from '../errors.ts';
import type { PublishSourceReleaseInput } from './types.ts';

/** The folder in the stack's state folder that holds the release dev builds of this source. */
const RELEASE_FOLDER = 'release';

/** Builds and publishes the source checkout’s CLI for the local installer. */
export const publishSourceRelease = Effect.fn('publishSourceRelease')(function* ({
  stack,
}: PublishSourceReleaseInput): Effect.fn.Return<void, StackFailed | ReleaseFailed> {
  const folder = join(stack.stateFolder, RELEASE_FOLDER);
  const target = yield* hostTarget();

  yield* buildRelease({
    release: RELEASE,
    revision: stack.workerRevision,
    targets: [target],
    folder,
    inherited: stack.settings.inherited,
  });
  yield* stack.publish({ folder });
});
