import { Option, Result, Schema } from 'effect';
import { ROOT_DOT } from './constants.ts';
import { EgressDestination } from './schemas.ts';

/** A Host header contains only an authority, never a path, credentials, or a second destination. */
const HOST_AUTHORITY = /^[a-z\d.-]+(?::\d+)?$/i;

type HasMatchingAuthorityInput = {
  /** Absent when the runtime supplied no Host header; the URL still selects the destination. */
  readonly authority: Option.Option<string>;
  readonly destination: URL;
};

type AuthorityUrlInput = { readonly protocol: string; readonly authority: string };

/** The URL selects the upstream; a supplied Host cannot select a different host or port. */
export function hasMatchingAuthority({ authority, destination }: HasMatchingAuthorityInput): boolean {
  if (Option.isNone(authority)) {
    return true;
  }

  if (!HOST_AUTHORITY.test(authority.value)) {
    return false;
  }

  const address = authorityUrl({ protocol: destination.protocol, authority: authority.value });
  const decoded = Schema.decodeUnknownResult(EgressDestination)(address);

  if (Result.isFailure(decoded)) {
    return false;
  }

  return decoded.success.hostname.replace(ROOT_DOT, '') === destination.hostname;
}

function authorityUrl({ protocol, authority }: AuthorityUrlInput): string {
  return `${protocol}//${authority}/`;
}
