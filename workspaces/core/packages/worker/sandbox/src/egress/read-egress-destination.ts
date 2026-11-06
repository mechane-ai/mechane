import { HttpHeader } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import { ROOT_DOT } from './constants.ts';
import { hasMatchingAuthority } from './has-matching-authority.ts';
import { isPackageHost } from './is-package-host.ts';
import { EgressDestination } from './schemas.ts';

type ReadEgressDestinationInput = {
  readonly request: Request;
  readonly origin: URL;
  readonly hosts: ReadonlyArray<string>;
};

/** Unlisted hosts include literal addresses, private networks, localhost, and the installation itself. */
export function readEgressDestination({ request, origin, hosts }: ReadEgressDestinationInput): Option.Option<URL> {
  const decoded = Schema.decodeUnknownResult(EgressDestination)(request.url);

  if (Result.isFailure(decoded)) {
    return Option.none();
  }

  const destination = new URL(decoded.success.href);

  destination.hostname = destination.hostname.replace(ROOT_DOT, '');

  const isAllowedHost = isPackageHost({ hostname: destination.hostname }) || hosts.includes(destination.hostname);
  const installationHost = origin.hostname.replace(ROOT_DOT, '');

  if (!isAllowedHost || destination.hostname === installationHost) {
    return Option.none();
  }

  const suppliedAuthority = request.headers.get(HttpHeader.Host);
  const authority = Option.fromNullishOr(suppliedAuthority);

  if (!hasMatchingAuthority({ authority, destination })) {
    return Option.none();
  }

  return Option.some(destination);
}
