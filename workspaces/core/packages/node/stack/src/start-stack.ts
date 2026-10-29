import type { LocalSandboxProvider } from '@mechane/deployment';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { StackFailed } from './errors.ts';
import { freeLoopbackOrigin } from './loopback/free-loopback-origin.ts';
import { localServices } from './services/local-services.ts';
import { startRuntime } from './start-runtime.ts';
import { freshStateFolder } from './state/fresh-state-folder.ts';
import type { Stack, StackSettings, StackVariables } from './types.ts';

type StartStackInput = {
  readonly settings: StackSettings;
  /**
   * Variables the program that starts the stack sets over the deployment configuration's and the scripted upstream's,
   * such as a key lifetime.
   */
  readonly variables: StackVariables;
  /** Where the stack runs sandboxes; host refuses a person's model upstream, since host machines run as the person. */
  readonly sandboxProvider: LocalSandboxProvider;
};

/**
 * Starts a fresh local stack: a new state folder, the local services the Worker calls, the staged Worker, and celld on
 * a free loopback port. Closing the scope stops every server, then removes the state folder, or only the staged
 * variables when the scope failed, so its log and its objects' databases stay readable.
 */
export const startStack = Effect.fn('startStack')(function* ({
  settings,
  variables,
  sandboxProvider,
}: StartStackInput): Effect.fn.Return<Stack, StackFailed, Scope.Scope> {
  const layout = yield* freshStateFolder({ stateRoot: settings.stateRoot });
  const origin = yield* freeLoopbackOrigin();
  const { sandboxesFolder } = layout;
  const services = yield* localServices({ origin, settings, sandboxProvider, sandboxesFolder, variables });

  const runtime = yield* startRuntime({
    settings,
    layout,
    origin,
    variables: { ...services.variables, ...variables },
    sandboxProvider,
    isPersistent: false,
  });

  return { ...runtime, ...services.served };
});
