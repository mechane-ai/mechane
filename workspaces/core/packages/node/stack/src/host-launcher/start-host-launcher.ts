import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { StackFailed } from '../errors.ts';
import { serveRequests } from '../loopback/serve-requests.ts';
import type { StackSettings } from '../types.ts';
import { answerLauncherRequest } from './answer-launcher-request.ts';
import { hostMachines } from './host-machines.ts';

type StartHostLauncherInput = {
  readonly settings: StackSettings;
  /** The folder that holds each machine's own folder. */
  readonly sandboxesFolder: string;
  /** The key the stack's Worker presents, which no other caller holds. */
  readonly launcherKey: string;
};

/**
 * Serves the host launcher on a loopback port until the scope closes, and answers with its origin. It runs each host
 * machine as a process of its own, as the person who started the stack, so it isolates nothing. Closing the scope stops
 * every machine, once the launcher no longer takes requests.
 */
export const startHostLauncher = Effect.fn('startHostLauncher')(function* ({
  settings,
  sandboxesFolder,
  launcherKey,
}: StartHostLauncherInput): Effect.fn.Return<URL, StackFailed, Scope.Scope> {
  const machines = hostMachines({ settings, sandboxesFolder });

  yield* Effect.acquireRelease(Effect.void, () => machines.stopEach());

  return yield* serveRequests({ answer: (request) => answerLauncherRequest({ request, machines, launcherKey }) });
});
