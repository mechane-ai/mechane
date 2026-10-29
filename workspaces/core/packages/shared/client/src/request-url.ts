import { Option, Record } from 'effect';

/** Text fields as an operation's path or query schema encodes them. */
type TextFields = Readonly<Record<string, string>>;

/** The deployment's origin, and an operation's path with the encoded fields of its path and query. */
type RequestUrlInput = {
  readonly origin: URL;
  readonly path: string;
  readonly params: TextFields;
  readonly query: TextFields;
};

/** One segment of an operation's path, and the encoded path parameters a `:name` segment takes its value from. */
type PathSegmentInput = { readonly segment: string; readonly params: TextFields };

/** Builds an operation's URL: each `:name` segment takes the encoded path parameter of that name. */
export function requestUrl({ origin, path, params, query }: RequestUrlInput): URL {
  const segments = path.split('/').map((segment) => pathSegment({ segment, params }));
  const url = new URL(segments.join('/'), origin);

  url.search = new URLSearchParams(query).toString();

  return url;
}

/** A path segment as the URL writes it: as declared, or a `:name` segment's parameter, percent-encoded. */
function pathSegment({ segment, params }: PathSegmentInput): string {
  if (!segment.startsWith(':')) {
    return segment;
  }

  // The catalog's params schema encodes every parameter its path names, so a missing one is a defect of the catalog.
  const value = Option.getOrThrow(Record.get(params, segment.slice(1)));

  return encodeURIComponent(value);
}
