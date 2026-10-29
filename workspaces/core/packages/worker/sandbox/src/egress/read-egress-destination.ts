import { HttpHeader } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import { ROOT_DOT } from './constants.ts';
import { hasMatchingAuthority } from './has-matching-authority.ts';
import { isPackageHost } from './is-package-host.ts';
import { EgressDestination } from './schemas.ts';

type ReadEgressDestinationInput = { readonly request: Request; readonly origin: URL };

/** Unlisted hosts include literal addresses, private networks, localhost, and the installation itself. */
export function readEgressDestination({ request, origin }: ReadEgressDestinationInput): Option.Option<URL> {
  const decoded = Schema.decodeUnknownResult(EgressDestination)(request.url);

  if (Result.isFailure(decoded)) {
    return Option.none();
  }

  const destination = new URL(decoded.success.href);

  destination.hostname = destination.hostname.replace(ROOT_DOT, '');

  if (
    !isPackageHost({ hostname: destination.hostname }) ||
    destination.hostname === origin.hostname.replace(ROOT_DOT, '')
  ) {
    return Option.none();
  }

  const suppliedAuthority = request.headers.get(HttpHeader.Host);
  const authority = Option.fromNullishOr(suppliedAuthority);

  if (!hasMatchingAuthority({ authority, destination })) {
    return Option.none();
  }

  return Option.some(destination);
}
