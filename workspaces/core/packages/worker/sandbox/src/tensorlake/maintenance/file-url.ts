type FileUrlInput = { readonly origin: URL; readonly path: string };

/** Tensorlake's native file API keeps file paths in the query, separate from the endpoint path. */
export function fileUrl({ origin, path }: FileUrlInput): URL {
  const url = new URL('/api/v1/files', origin);

  url.searchParams.set('path', path);

  return url;
}
