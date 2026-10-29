import type { SourceClone } from '@mechane/sandbox-wire';
import { Effect, Option } from 'effect';
import type { Redacted } from 'effect';
import { mkdir } from 'node:fs/promises';
import { SourceGuestFailed } from '../../errors.ts';
import type { GuestSettings } from '../../types.ts';
import { PRIVATE_DIRECTORY_MODE } from './constants.ts';
import { runSourceGit } from './run-source-git.ts';
import { sourceStagingPath } from './source-staging-path.ts';

/** The immutable checkout request, including its credential for the fetch alone. */
type CloneSourceInput = { readonly settings: GuestSettings; readonly clone: SourceClone };
type CheckoutSourceCommitInput = Pick<SourceClone, 'sourceId' | 'commit'> & { readonly folder: string };

/** Initializes a clean staging repository and checks out only the exact commit the Worker resolved. */
export const cloneSource = Effect.fn('cloneSource')(function* ({
  settings,
  clone,
}: CloneSourceInput): Effect.fn.Return<void, SourceGuestFailed> {
  const { sourceId, generation, repositoryUrl, commit, token } = clone;
  const folder = sourceStagingPath({ home: settings.home, generation });
  const anonymous = Option.none<Redacted.Redacted>();
  const authentication = Option.some(token);

  yield* Effect.tryPromise({
    try: () => mkdir(folder, { mode: PRIVATE_DIRECTORY_MODE }),
    catch: () =>
      new SourceGuestFailed({ sourceId, reason: 'source staging directory already exists or is unavailable' }),
  });
  yield* runSourceGit({
    sourceId,
    folder,
    token: anonymous,
    arguments: ['init', '--quiet', '--initial-branch=mechane', '--', '.'],
  });
  yield* runSourceGit({ sourceId, folder, token: anonymous, arguments: ['remote', 'add', 'origin', repositoryUrl] });
  yield* runSourceGit({
    sourceId,
    folder,
    arguments: ['fetch', '--quiet', '--depth=1', '--no-tags', '--', 'origin', commit],
    token: authentication,
  });

  yield* checkoutSourceCommit({ sourceId, folder, commit });
});

/** Checks the fetched object before a local checkout that receives no token. */
const checkoutSourceCommit = Effect.fn('checkoutSourceCommit')(function* ({
  sourceId,
  folder,
  commit,
}: CheckoutSourceCommitInput): Effect.fn.Return<void, SourceGuestFailed> {
  const anonymous = Option.none<Redacted.Redacted>();

  const fetched = yield* runSourceGit({
    sourceId,
    folder,
    token: anonymous,
    arguments: ['rev-parse', '--verify', 'FETCH_HEAD^{commit}'],
  });

  if (fetched.trim() !== commit) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'GitHub returned a different commit' });
  }

  yield* runSourceGit({
    sourceId,
    folder,
    token: anonymous,
    arguments: ['checkout', '--quiet', '--detach', '--force', commit],
  });
});
