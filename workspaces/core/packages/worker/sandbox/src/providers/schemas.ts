import { LoopbackOrigin, SANDBOX_VARIABLES, SandboxProvider, SecureOrigin } from '@mechane/deployment';
import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** Containers use the authenticated egress gateway; local guests use a loopback launcher. */
export const SandboxVariables = Schema.Union([
  renamedWireStruct({
    fields: { provider: Schema.Literal(SandboxProvider.Container), origin: SecureOrigin },
    renames: { provider: SANDBOX_VARIABLES.sandboxProvider, origin: SANDBOX_VARIABLES.origin },
  }),
  renamedWireStruct({
    fields: {
      provider: Schema.Literal(SandboxProvider.Host),
      launcherOrigin: LoopbackOrigin,
      launcherKey: Schema.RedactedFromValue(Schema.NonEmptyString),
    },
    renames: {
      provider: SANDBOX_VARIABLES.sandboxProvider,
      launcherOrigin: SANDBOX_VARIABLES.hostLauncherOrigin,
      launcherKey: SANDBOX_VARIABLES.hostLauncherKey,
    },
  }),
]);

export type SandboxVariables = typeof SandboxVariables.Type;
