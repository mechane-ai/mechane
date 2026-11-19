import { Option } from 'effect';
import generated from './requests.generated.json' with { type: 'json' };

type JsonSchema = Readonly<Record<string, unknown>>;

type Declaration = {
  readonly operation: string;
  readonly method: string;
  readonly path: string;
  readonly body: Option.Option<JsonSchema>;
  readonly isMultipart: boolean;
  readonly query: Readonly<Partial<Record<string, JsonSchema>>>;
};

type Params = Readonly<Record<string, string>>;
type Segments = ReadonlyArray<string>;
type MatchInput = { readonly segments: Segments; readonly actual: Segments };
type RouteInput = { readonly method: string; readonly pathname: string };

/** Opaque identifiers are bound only after the full method and path match the pinned operation. */
export type ManagedHttpRoute = Declaration & { readonly params: Params };

/** Named schemas referenced by public Managed Agents request bodies. */
export const managedRequestDefinitions: Readonly<Record<string, JsonSchema>> = generated.definitions;

const routes = generated.routes.map(({ multipart, body, method, path, query, operation }) => {
  const route: Declaration = {
    method,
    path,
    query,
    operation,
    isMultipart: multipart,
    body: Option.fromNullishOr(body),
  };

  return { route, segments: path.split('/') };
});

/** Methods, paths, and operation names recorded in the release wire inventory. */
export const managedOperations = routes.map(({ route: { method, path, operation } }) => ({ method, path, operation }));

function matchParams({ segments, actual }: MatchInput): Option.Option<Params> {
  if (segments.length !== actual.length) {
    return Option.none();
  }

  const params: Record<string, string> = {};

  for (const [index, segment] of segments.entries()) {
    const value = Option.fromUndefinedOr(actual[index]);

    if (Option.isNone(value)) {
      return Option.none();
    }

    if (segment.startsWith('{')) {
      if (value.value.length === 0 || value.value.includes('%') || value.value.includes('\\')) {
        return Option.none();
      }

      params[segment.slice(1, -1)] = value.value;
    } else if (segment !== value.value) {
      return Option.none();
    }
  }

  return Option.some(params);
}

/** Match a public request to its declared operation and bind its opaque path parameters. */
export function matchManagedRoute({ method, pathname }: RouteInput): Option.Option<ManagedHttpRoute> {
  const actual = pathname.split('/');

  for (const { route, segments } of routes) {
    if (method === route.method) {
      const params = matchParams({ segments, actual });

      if (Option.isSome(params)) {
        return Option.some({ ...route, params: params.value });
      }
    }
  }

  return Option.none();
}
