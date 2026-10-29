import {
  LOOPBACK_HOSTS,
  LoopbackOrigin,
  OriginProtocol,
  SandboxEgress,
  SandboxProvider,
  SecureOrigin,
  WORKER_VARIABLES,
} from '@mechane/deployment';
import { renamedWireStruct } from '@mechane/records';
import { Effect, Schema } from 'effect';

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
    fields: {
      provider: Schema.Literal(SandboxProvider.Container),
      /** Absent selects the Cloudflare gateway; local staging explicitly chooses the celld fence. */
      egress: Schema.Enum(SandboxEgress).pipe(Schema.withDecodingDefaultKey(Effect.succeed(SandboxEgress.Gateway))),
      origin: SecureOrigin,
    },
    renames: {
      provider: WORKER_VARIABLES.sandboxProvider,
      egress: WORKER_VARIABLES.sandboxEgress,
      origin: WORKER_VARIABLES.origin,
    },
  }).check(
    Schema.makeFilter(
      ({ egress, origin }) =>
        egress !== SandboxEgress.Fence ||
        (origin.protocol === OriginProtocol.Loopback && LOOPBACK_HOSTS.has(origin.hostname)),
      { expected: 'the local celld fence only on a loopback installation' },
    ),
  ),
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
