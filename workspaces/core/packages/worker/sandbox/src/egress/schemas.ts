import { OriginProtocol, SecureOrigin, WORKER_VARIABLES } from '@mechane/deployment';
import { renamedWireStruct } from '@mechane/records';
import { Effect, Schema } from 'effect';

const HOSTNAME_MAX_CHARS = 253;
const ADDITIONAL_HOSTS_MAX_COUNT = 64;

const PublicHostname = Schema.String.check(
  Schema.isMaxLength(HOSTNAME_MAX_CHARS),
  Schema.isPattern(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/u),
);

const AdditionalHosts = Schema.fromJsonString(
  Schema.Array(PublicHostname).check(Schema.isMaxLength(ADDITIONAL_HOSTS_MAX_COUNT)),
).pipe(Schema.withDecodingDefaultKey(Effect.succeed('[]')));

/** The gateway rejects its own origin and admits the installation's additional public hosts. */
export const EgressVariables = renamedWireStruct({
  fields: { origin: SecureOrigin, hosts: AdditionalHosts },
  renames: { origin: WORKER_VARIABLES.origin, hosts: WORKER_VARIABLES.sandboxHosts },
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
