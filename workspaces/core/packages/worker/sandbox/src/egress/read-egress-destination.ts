import { SandboxWebAccess } from '@mechane/deployment';
import { HttpHeader } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import { ROOT_DOT } from './constants.ts';
import { hasMatchingAuthority } from './has-matching-authority.ts';
import { isPackageHost } from './is-package-host.ts';
import { isPublicHost } from './is-public-host.ts';
import { EgressDestination } from './schemas.ts';

type ReadEgressDestinationInput = {
  readonly request: Request;
  readonly origin: URL;
  readonly runtimeOrigin: URL;
  readonly installationHosts: ReadonlyArray<string>;
  readonly hosts: ReadonlyArray<string>;
  readonly webAccess: SandboxWebAccess;
};

/** Public access still excludes private destinations and both installation control-plane hosts. */
export function readEgressDestination({
  request,
  origin,
  runtimeOrigin,
  installationHosts,
  hosts,
  webAccess,
}: ReadEgressDestinationInput): Option.Option<URL> {
  const decoded = Schema.decodeUnknownResult(EgressDestination)(request.url);

  if (Result.isFailure(decoded)) {
    return Option.none();
  }

  const destination = new URL(decoded.success.href);

  destination.hostname = destination.hostname.replace(ROOT_DOT, '');

  const isAllowedHost =
    webAccess === SandboxWebAccess.Public ||
    isPackageHost({ hostname: destination.hostname }) ||
    hosts.includes(destination.hostname);

  const installationHost = origin.hostname.replace(ROOT_DOT, '');
  const runtimeHost = runtimeOrigin.hostname.replace(ROOT_DOT, '');

  const isControlPlaneHost =
    installationHosts.includes(destination.hostname) ||
    destination.hostname === installationHost ||
    destination.hostname === runtimeHost;

  if (!isAllowedHost || !isPublicHost({ hostname: destination.hostname }) || isControlPlaneHost) {
    return Option.none();
  }

  const suppliedAuthority = request.headers.get(HttpHeader.Host);
  const authority = Option.fromNullishOr(suppliedAuthority);

  if (!hasMatchingAuthority({ authority, destination })) {
    return Option.none();
  }

  return Option.some(destination);
}
