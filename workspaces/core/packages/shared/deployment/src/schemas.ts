import { Schema } from 'effect';
import { LOOPBACK_HOSTS, OriginProtocol } from './constants.ts';

/** Credentials can reach HTTPS endpoints or explicit loopback HTTP endpoints. */
export const SecureOrigin = Schema.URLFromString.check(
  Schema.makeFilter(
    (url) =>
      url.protocol === OriginProtocol.Secure ||
      (url.protocol === OriginProtocol.Loopback && LOOPBACK_HOSTS.has(url.hostname)),
    { expected: `an ${OriginProtocol.Secure} URL, or an ${OriginProtocol.Loopback} URL of this machine` },
  ),
);

export type SecureOrigin = typeof SecureOrigin.Type;

export const ServiceOrigin = Schema.String.check(Schema.isPattern(/^https?:\/\/[^@/?#\\\s]+\/?$/iu))
  .pipe(Schema.decodeTo(SecureOrigin))
  .check(Schema.makeFilter((url) => url.protocol !== OriginProtocol.Loopback || url.port !== ''));

export type ServiceOrigin = typeof ServiceOrigin.Type;

/** The development guest launcher runs on the same machine as the local compute service. */
export const LoopbackOrigin = Schema.URLFromString.check(
  Schema.makeFilter((url) => url.protocol === OriginProtocol.Loopback && LOOPBACK_HOSTS.has(url.hostname), {
    expected: `an ${OriginProtocol.Loopback} URL of this machine`,
  }),
);

export type LoopbackOrigin = typeof LoopbackOrigin.Type;

/** Model identities remain the upstream provider's opaque names. */
export const ModelId = Schema.NonEmptyString;

export type ModelId = typeof ModelId.Type;
