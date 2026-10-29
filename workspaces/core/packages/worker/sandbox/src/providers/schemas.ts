import { LoopbackOrigin, SandboxProvider, WORKER_VARIABLES } from '@mechane/deployment';
import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/**
 * The variables a sandbox's object reads: its provider, and for containers how their machines reach the internet. The
 * host provider, which only a local stack stages, reads the launcher on this machine and its key, which stays
 * redacted.
 */
export const SandboxVariables = Schema.Union([
  renamedWireStruct({
    fields: {
      provider: Schema.Literal(SandboxProvider.Tensorlake),
      apiKey: Schema.RedactedFromValue(Schema.NonEmptyString),
      image: Schema.NonEmptyString,
    },
    renames: {
      provider: WORKER_VARIABLES.sandboxProvider,
      apiKey: WORKER_VARIABLES.tensorlakeApiKey,
      image: WORKER_VARIABLES.tensorlakeImage,
    },
  }),
  renamedWireStruct({
    fields: { provider: Schema.Literal(SandboxProvider.Container) },
    renames: { provider: WORKER_VARIABLES.sandboxProvider },
  }),
  renamedWireStruct({
    fields: {
      provider: Schema.Literal(SandboxProvider.Host),
      launcherOrigin: LoopbackOrigin,
      launcherKey: Schema.RedactedFromValue(Schema.NonEmptyString),
    },
    renames: {
      provider: WORKER_VARIABLES.sandboxProvider,
      launcherOrigin: WORKER_VARIABLES.hostLauncherOrigin,
      launcherKey: WORKER_VARIABLES.hostLauncherKey,
    },
  }),
]);

export type SandboxVariables = typeof SandboxVariables.Type;
