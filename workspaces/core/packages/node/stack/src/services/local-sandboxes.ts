import { LocalSandboxProvider, SandboxEgress, WORKER_VARIABLES } from '@mechane/deployment';
import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { randomBytes } from 'node:crypto';
import { SECRET_BYTES, StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { startHostLauncher } from '../host-launcher/start-host-launcher.ts';
import type { StackSettings, StackVariables } from '../types.ts';
import type { LocalService } from './types.ts';

type LocalSandboxesInput = {
  readonly sandboxProvider: LocalSandboxProvider;
  readonly settings: StackSettings;
  readonly sandboxesFolder: string;
  /** The program's own variables, which name a person's model upstream when they set one. */
  readonly variables: StackVariables;
};

type HostSandboxesInput = Omit<LocalSandboxesInput, 'sandboxProvider'>;

/**
 * The stack's sandboxes. For host, the launcher with a fresh key, and the variables that point the Worker at it. For
 * containers, celld's network fence; the configuration's provider stands.
 */
export const localSandboxes = Effect.fn('localSandboxes')(function* ({
  sandboxProvider,
  settings,
  sandboxesFolder,
  variables,
}: LocalSandboxesInput): Effect.fn.Return<LocalService<Option.Option<string>>, StackFailed, Scope.Scope> {
  switch (sandboxProvider) {
    case LocalSandboxProvider.Container:
      return { service: Option.none(), variables: { sandboxEgress: SandboxEgress.Fence } };
    case LocalSandboxProvider.Host:
      return yield* hostSandboxes({ settings, sandboxesFolder, variables });
  }
});

/**
 * The host launcher with a fresh key. Host machines run as the person who started the stack, so they never run beside a
 * person's own model, whose commands no scenario wrote.
 */
const hostSandboxes = Effect.fn('hostSandboxes')(function* ({
  settings,
  sandboxesFolder,
  variables,
}: HostSandboxesInput): Effect.fn.Return<LocalService<Option.Option<string>>, StackFailed, Scope.Scope> {
  if (Option.isSome(Option.fromNullishOr(variables.modelUpstream))) {
    return yield* new StackFailed({
      step: StackStep.StartHostSandboxes,
      reason: `a host machine runs a model's commands as you on this machine, so it takes only the scripted model; unset ${WORKER_VARIABLES.sandboxProvider} or the model variables`,
    });
  }

  const launcherKey = randomBytes(SECRET_BYTES).toString('hex');
  const launcher = yield* startHostLauncher({ settings, sandboxesFolder, launcherKey });

  return {
    service: Option.some(launcherKey),
    variables: {
      sandboxProvider: LocalSandboxProvider.Host,
      hostLauncherOrigin: launcher.origin,
      hostLauncherKey: launcherKey,
    },
  };
});
