import { Result, Schema } from 'effect';
import { PublicHostname } from './schemas.ts';

const PRIVATE_SUFFIXES = [
  'localhost',
  'local',
  'internal',
  'intranet',
  'home',
  'lan',
  'arpa',
  'onion',
  'invalid',
  'test',
  'example',
  'alt',
] as const;

type IsPublicHostInput = { readonly hostname: string };

/** The gateway uses Cloudflare's Internet-only fetch, never a VPC or origin binding. */
export function isPublicHost({ hostname }: IsPublicHostInput): boolean {
  const decoded = Schema.decodeUnknownResult(PublicHostname)(hostname);

  if (Result.isFailure(decoded)) {
    return false;
  }

  const isPrivate: (suffix: string) => boolean = (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`);

  return !PRIVATE_SUFFIXES.some(isPrivate);
}
