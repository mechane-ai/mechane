import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { Miniflare, MiniflareOptions } from 'miniflare';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { createCloudflareRuntime } from './create-cloudflare-runtime.ts';

type OpenCloudflareRuntimeInput = { readonly options: MiniflareOptions };

type AwaitCloudflareRuntimeInput = { readonly runtime: Miniflare };

/** The stack's scope owns the workerd process and waits for it before returning a usable origin. */
export const openCloudflareRuntime = Effect.fn('openCloudflareRuntime')(function* ({
  options,
}: OpenCloudflareRuntimeInput): Effect.fn.Return<Miniflare, StackFailed, Scope.Scope> {
  const acquire = Effect.try({
    try: () => createCloudflareRuntime({ options }),
    catch: (cause) => new StackFailed({ step: StackStep.StartCloudflare, reason: String(cause) }),
  });

  const release: (runtime: Miniflare) => Effect.Effect<void> = (runtime) => {
    const closed = Effect.tryPromise({
      try: () => runtime.dispose(),
      catch: (cause) => new StackFailed({ step: StackStep.StartCloudflare, reason: String(cause) }),
    });

    return Effect.orDie(closed);
  };

  const runtime = yield* Effect.acquireRelease(acquire, release);

  yield* Effect.tryPromise({
    try: () => awaitCloudflareRuntime({ runtime }),
    catch: (cause) => new StackFailed({ step: StackStep.StartCloudflare, reason: String(cause) }),
  });

  return runtime;
});

async function awaitCloudflareRuntime({ runtime }: AwaitCloudflareRuntimeInput): Promise<URL> {
  return await runtime.ready;
}
