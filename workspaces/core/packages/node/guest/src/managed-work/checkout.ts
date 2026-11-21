import type { BetaManagedAgentsSession } from '@anthropic-ai/sdk/resources/beta/sessions/sessions';
import { HttpHeader } from '@mechane/records';
import { ManagedGitIdentity, managedGitIdentityPath } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Effect, Exit, Option, Schema } from 'effect';
import { createOutputExportState, exportSessionOutputs } from './file-export.ts';
import { mountSessionFile } from './file-mount.ts';
import { GitMountFailed, mountGitRepository } from './git-mount.ts';
import { gitMountRoute, startGitRelay } from './git-relay.ts';

type ManagedGitCheckout = {
  readonly origin: string;
  readonly sessionId: BetaManagedAgentsSession['id'];
  readonly session: Pick<BetaManagedAgentsSession, 'resources'>;
  readonly token: string;
  readonly transport: typeof fetch;
  readonly workspace: string;
  readonly signal: AbortSignal;
};

type MountedGitCheckout = { readonly close: () => Promise<void> | void };
type GitSession = Pick<ManagedGitCheckout, 'origin' | 'sessionId' | 'signal' | 'token'>;
const GIT_REPOSITORY = 'github_repository';
const FILE_RESOURCE = 'file';

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

type SessionOutputExporterInput = Pick<ManagedGitCheckout, 'origin' | 'token' | 'transport' | 'workspace' | 'signal'>;
type QueuedExport = { readonly previous: Option.Option<Promise<void>> };

export type SessionOutputExporter = { readonly flush: () => Promise<void>; readonly flushOnce: () => Promise<void> };

/** Serializes `/workspace/outputs/` uploads so concurrent tool completions never duplicate an export. */
export function createSessionOutputExporter({
  origin,
  token,
  transport,
  workspace,
  signal,
}: SessionOutputExporterInput): SessionOutputExporter {
  const state = createOutputExportState();
  const queue = { current: Option.none<Promise<void>>(), hasFlushedClose: false };

  async function runExport(): Promise<void> {
    const program = exportSessionOutputs({ origin, token, transport, workspace, signal, state });
    const execution = Effect.runPromise(program);

    await capturePromise({ promise: execution });
  }

  async function runQueued({ previous }: QueuedExport): Promise<void> {
    if (Option.isSome(previous)) {
      await previous.value;
    }

    await runExport();
  }

  async function flush(): Promise<void> {
    const next = runQueued({ previous: queue.current });

    queue.current = Option.some(next);

    await next;
  }

  async function flushOnce(): Promise<void> {
    if (queue.hasFlushedClose) {
      return;
    }

    queue.hasFlushedClose = true;

    await flush();
  }

  return { flush, flushOnce };
}

/** The SDK work handler owns this relay until its claim ends. */
export async function prepareManagedGitCheckout({
  origin,
  sessionId,
  token,
  transport,
  workspace,
  session,
  signal,
}: ManagedGitCheckout): Promise<MountedGitCheckout> {
  const files = session.resources.filter((resource) => resource.type === FILE_RESOURCE);

  if (files.length > 0) {
    const fileMounts = Effect.forEach(
      files,
      (resource) => mountSessionFile({ origin, resource, token, transport, workspace, signal }),
      { concurrency: 1, discard: true },
    );

    await Effect.runPromise(fileMounts);
  }

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
