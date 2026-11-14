import { OriginProtocol, SandboxWebAccess } from '@mechane/deployment';
import { Access, catalog, findRoute } from '@mechane/protocol';
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

type SelfRouteInput = { readonly request: Request; readonly destination: URL };

/** Only declared self operations can reach the canonical public control plane through its normal authentication. */
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
  const isCanonicalOrigin = destination.origin === origin.origin;

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

  const isSelfOperation =
    isCanonicalOrigin && destination.protocol === OriginProtocol.Secure && isSelfRoute({ request, destination });

  const isAllowedDestination = isSelfOperation || (isAllowedHost && !isControlPlaneHost);

  if (!isAllowedDestination || !isPublicHost({ hostname: destination.hostname })) {
    return Option.none();
  }

  const suppliedAuthority = request.headers.get(HttpHeader.Host);
  const authority = Option.fromNullishOr(suppliedAuthority);

  if (!hasMatchingAuthority({ authority, destination })) {
    return Option.none();
  }

  return Option.some(destination);
}

function isSelfRoute({ request, destination }: SelfRouteInput): boolean {
  const matched = Result.try(() => findRoute({ method: request.method, pathname: destination.pathname }));

  if (Result.isFailure(matched)) {
    return false;
  }

  return Option.exists(matched.success, (route) => {
    const operation = catalog[route.name];

    if (operation.access !== Access.Self) {
      return false;
    }

    const params = Schema.decodeUnknownResult(operation.params, { onExcessProperty: 'error' })(route.params);

    return Result.isSuccess(params);
  });
}
