import type { BetaManagedAgentsSession } from '@anthropic-ai/sdk/resources/beta/sessions/sessions';
import { HttpHeader } from '@mechane/records';
import { ManagedGitIdentity, managedGitIdentityPath } from '@mechane/sandbox-wire';
import { Effect, Exit, Schema } from 'effect';
import { GitMountFailed, mountGitRepository } from './git-mount.ts';
import { gitMountRoute, startGitRelay } from './git-relay.ts';

type ManagedGitCheckout = {
  readonly origin: string;
  readonly sessionId: BetaManagedAgentsSession['id'];
  readonly session: Pick<BetaManagedAgentsSession, 'resources'>;
  readonly token: string;
  readonly workspace: string;
  readonly signal: AbortSignal;
};

type MountedGitCheckout = { readonly close: () => Promise<void> | void };
type GitSession = Pick<ManagedGitCheckout, 'origin' | 'sessionId' | 'signal' | 'token'>;
const GIT_REPOSITORY = 'github_repository';

const gitIdentity = Effect.fn('gitIdentity')(function* ({
  origin,
  sessionId,
  token,
  signal,
}: GitSession): Effect.fn.Return<typeof ManagedGitIdentity.Type, GitMountFailed> {
  const route = managedGitIdentityPath({ sessionId });
  const url = new URL(route, origin);
  const headers = { [HttpHeader.Authorization]: `Bearer ${token}` };

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, { headers, signal, redirect: 'error' }),
    catch: () => new GitMountFailed({ reason: 'Cannot reach Git identity service' }),
  });

  if (!response.ok) {
    return yield* new GitMountFailed({ reason: `Git identity request failed with HTTP ${response.status}` });
  }

  const json: unknown = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () => new GitMountFailed({ reason: 'Git identity response is unreadable' }),
  });

  const decoded = Schema.decodeUnknownEffect(ManagedGitIdentity)(json);

  return yield* Effect.mapError(decoded, () => new GitMountFailed({ reason: 'Invalid Git author identity' }));
});

/** The SDK work handler owns this relay until its claim ends. */
export async function prepareManagedGitCheckout({
  origin,
  sessionId,
  token,
  workspace,
  session,
  signal,
}: ManagedGitCheckout): Promise<MountedGitCheckout> {
  const repositories = session.resources.filter((resource) => resource.type === GIT_REPOSITORY);

  if (repositories.length === 0) {
    return { close: () => undefined };
  }

  const lookup = gitIdentity({ origin, sessionId, token, signal });
  const identity = await Effect.runPromise(lookup);
  const resourceIds = repositories.map((resource) => resource.id);
  const relay = await startGitRelay({ origin, sessionId, token, signal, resourceIds });

  const mounting = Effect.forEach(
    repositories,
    (resource) => {
      const route = gitMountRoute({ sessionId, resourceId: resource.id });
      const remote = new URL(route, relay.origin);

      return mountGitRepository({ workspace, resource, remote, signal, identity });
    },
    { concurrency: 1, discard: true },
  );

  const mounted = await Effect.runPromiseExit(mounting);

  if (Exit.isFailure(mounted)) {
    await relay.close();

    const failure = Effect.failCause(mounted.cause);

    return await Effect.runPromise(failure);
  }

  return { close: relay.close };
}
