import { Duration } from 'effect';

type CacheControlInput = { readonly maxAge: Duration.Duration; readonly isImmutable: boolean };

/**
 * The `cache-control` value that lets any cache keep a response for `maxAge`, and never revalidate it when it is
 * immutable, as a release's own file is once published.
 */
export function cacheControl({ maxAge, isImmutable }: CacheControlInput): string {
  const immutability: string = (() => {
    if (isImmutable) {
      return ', immutable';
    }

    return '';
  })();

  return `public, max-age=${Duration.toSeconds(maxAge)}${immutability}`;
}
