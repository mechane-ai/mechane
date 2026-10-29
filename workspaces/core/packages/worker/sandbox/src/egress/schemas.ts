import { OriginProtocol, SecureOrigin, WORKER_VARIABLES } from '@mechane/deployment';
import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** The gateway needs only the deployment origin whose host it refuses. */
export const EgressVariables = renamedWireStruct({
  fields: { origin: SecureOrigin },
  renames: { origin: WORKER_VARIABLES.origin },
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
