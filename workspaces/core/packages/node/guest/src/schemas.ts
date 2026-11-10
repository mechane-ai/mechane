import { MachineId, renamedWireStruct } from '@mechane/records';
import {
  BrowserCertificateVariable,
  BrowserSandboxDisabledVariable,
  GUEST_VARIABLES,
  GuestScope,
  SandboxToolsVariable,
  TrustedCertificatesVariable,
} from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import { CONTAINER_DEFAULTS } from './constants.ts';

/**
 * The guest's environment: the machine it serves, which its provider starts it with, the host and port it listens on,
 * and the `PATH` every execution searches. A container's start names no host or port, so it takes the image's.
 */
export const GuestEnvironment = renamedWireStruct({
  fields: {
    machineId: MachineId,
    scope: Schema.Enum(GuestScope),
    /** The host to listen on, absent in a container's start, whose guest listens on every interface. */
    host: Schema.NonEmptyString.pipe(Schema.withDecodingDefaultKey(Effect.succeed(CONTAINER_DEFAULTS.host))),
    /** The port to listen on, absent in a container's start, whose guest listens on the image's port. */
    port: Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 65_535 })).pipe(
      Schema.withDecodingDefaultKey(Effect.succeed(CONTAINER_DEFAULTS.port)),
    ),
    path: Schema.NonEmptyString,
    additionalTools: SandboxToolsVariable,
    isBrowserSandboxDisabled: BrowserSandboxDisabledVariable,
    browserCertificateFile: BrowserCertificateVariable,
    trustedCertificatesPem: TrustedCertificatesVariable,
  },
  renames: {
    machineId: GUEST_VARIABLES.machineId,
    scope: GUEST_VARIABLES.scope,
    host: GUEST_VARIABLES.host,
    port: GUEST_VARIABLES.port,
    path: 'PATH',
    additionalTools: GUEST_VARIABLES.additionalTools,
    isBrowserSandboxDisabled: GUEST_VARIABLES.isBrowserSandboxDisabled,
    browserCertificateFile: GUEST_VARIABLES.browserCertificateFile,
    trustedCertificatesPem: GUEST_VARIABLES.trustedCertificatesPem,
  },
});

export type GuestEnvironment = typeof GuestEnvironment.Type;
