import { Effect } from 'effect';
import type { Miniflare } from 'miniflare';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { StackVariables } from '../types.ts';
import { cloudflareOptions } from './cloudflare-options.ts';
import type { CloudflareOptionsInput } from './types.ts';

type RestartCloudflareInput = {
  readonly runtime: Miniflare;
  readonly context: CloudflareOptionsInput;
  readonly variables: StackVariables;
};

/** Restarts workerd with replacement variables while keeping its durable state. */
export const restartCloudflare = Effect.fn('restartCloudflare')(function* ({
  runtime,
  context,
  variables,
}: RestartCloudflareInput): Effect.fn.Return<void, StackFailed> {
  const options = cloudflareOptions({ ...context, variables: { ...context.variables, ...variables } });

  yield* Effect.tryPromise({
    try: () => runtime.setOptions(options),
    catch: (cause) => new StackFailed({ step: StackStep.StartCloudflare, reason: String(cause) }),
  });
});
