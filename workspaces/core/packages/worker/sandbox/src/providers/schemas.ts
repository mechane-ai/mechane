import {
  LoopbackOrigin,
  SANDBOX_VARIABLES,
  SandboxContainerNetwork,
  SandboxProvider,
  SecureOrigin,
} from '@mechane/deployment';
import { renamedWireStruct } from '@mechane/records';
import {
  BrowserSandboxDisabledVariable,
  SandboxToolsVariable,
  TrustedCertificatesVariable,
} from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';

/** Containers use the authenticated egress gateway; local guests use a loopback launcher. */
export const SandboxVariables = Schema.Union([
  renamedWireStruct({
    fields: {
      provider: Schema.Literal(SandboxProvider.Container),
      origin: SecureOrigin,
      additionalTools: SandboxToolsVariable,
      isBrowserSandboxDisabled: BrowserSandboxDisabledVariable,
      trustedCertificatesPem: TrustedCertificatesVariable,
      containerNetwork: Schema.Enum(SandboxContainerNetwork).pipe(
        Schema.withDecodingDefaultKey(Effect.succeed(SandboxContainerNetwork.Gateway)),
      ),
    },
    renames: {
      provider: SANDBOX_VARIABLES.sandboxProvider,
      origin: SANDBOX_VARIABLES.origin,
      additionalTools: SANDBOX_VARIABLES.sandboxTools,
      isBrowserSandboxDisabled: SANDBOX_VARIABLES.isBrowserSandboxDisabled,
      trustedCertificatesPem: SANDBOX_VARIABLES.trustedCertificatesPem,
      containerNetwork: SANDBOX_VARIABLES.containerNetwork,
    },
  }),
  renamedWireStruct({
    fields: {
      provider: Schema.Literal(SandboxProvider.Host),
      launcherOrigin: LoopbackOrigin,
      launcherKey: Schema.RedactedFromValue(Schema.NonEmptyString),
      additionalTools: SandboxToolsVariable,
      isBrowserSandboxDisabled: BrowserSandboxDisabledVariable,
      trustedCertificatesPem: TrustedCertificatesVariable,
    },
    renames: {
      provider: SANDBOX_VARIABLES.sandboxProvider,
      launcherOrigin: SANDBOX_VARIABLES.hostLauncherOrigin,
      launcherKey: SANDBOX_VARIABLES.hostLauncherKey,
      additionalTools: SANDBOX_VARIABLES.sandboxTools,
      isBrowserSandboxDisabled: SANDBOX_VARIABLES.isBrowserSandboxDisabled,
      trustedCertificatesPem: SANDBOX_VARIABLES.trustedCertificatesPem,
    },
  }),
]);

export type SandboxVariables = typeof SandboxVariables.Type;
