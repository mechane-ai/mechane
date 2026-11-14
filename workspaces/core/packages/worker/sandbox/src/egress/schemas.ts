import { OriginProtocol, SANDBOX_VARIABLES, SandboxWebAccess, SecureOrigin } from '@mechane/deployment';
import { renamedWireStruct } from '@mechane/records';
import { Effect, Schema } from 'effect';

const HOSTNAME_MAX_CHARS = 253;
const ADDITIONAL_HOSTS_MAX_COUNT = 64;

/** The DNS spelling accepted before destination policy rejects private and reserved hosts. */
export const PublicHostname = Schema.String.check(
  Schema.isMaxLength(HOSTNAME_MAX_CHARS),
  Schema.isPattern(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/u),
);

export type PublicHostname = typeof PublicHostname.Type;

const AdditionalHosts = Schema.fromJsonString(
  Schema.Array(PublicHostname).check(Schema.isMaxLength(ADDITIONAL_HOSTS_MAX_COUNT)),
).pipe(Schema.withDecodingDefaultKey(Effect.succeed('[]')));

const InstallationHosts = Schema.fromJsonString(Schema.Array(PublicHostname)).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed('[]')),
);

/** Control-plane hosts stay private except for canonical self operations authenticated by the application. */
export const EgressVariables = renamedWireStruct({
  fields: {
    origin: SecureOrigin,
    runtimeOrigin: SecureOrigin,
    installationHosts: InstallationHosts,
    hosts: AdditionalHosts,
    webAccess: Schema.Enum(SandboxWebAccess).pipe(
      Schema.withDecodingDefaultKey(Effect.succeed(SandboxWebAccess.Packages)),
    ),
  },
  renames: {
    origin: SANDBOX_VARIABLES.origin,
    runtimeOrigin: SANDBOX_VARIABLES.runtimeOrigin,
    installationHosts: SANDBOX_VARIABLES.installationHosts,
    hosts: SANDBOX_VARIABLES.sandboxHosts,
    webAccess: SANDBOX_VARIABLES.sandboxWebAccess,
  },
});

export type EgressVariables = typeof EgressVariables.Type;

const EGRESS_PROTOCOLS: ReadonlySet<string> = new Set([OriginProtocol.Secure, OriginProtocol.Loopback]);

/** Only default HTTP(S) ports can cross the container intercept boundary. */
export const EgressDestination = Schema.URLFromString.check(
  Schema.makeFilter((url) => EGRESS_PROTOCOLS.has(url.protocol)),
  Schema.makeFilter((url) => url.username === '' && url.password === ''),
  Schema.makeFilter((url) => url.port === '' && url.hash === ''),
);

export type EgressDestination = typeof EgressDestination.Type;
