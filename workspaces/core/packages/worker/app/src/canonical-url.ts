type CanonicalUrlInput = { readonly url: URL; readonly origin: URL };

/** Keeps the request's path and query on the configured origin, even when its path starts with two slashes. */
export function canonicalUrl({ url, origin }: CanonicalUrlInput): URL {
  const canonical = new URL(url);

  canonical.protocol = origin.protocol;
  canonical.host = origin.host;
  canonical.port = origin.port;

  return canonical;
}
