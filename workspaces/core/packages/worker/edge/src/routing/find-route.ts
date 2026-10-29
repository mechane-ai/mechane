import { catalog, RouteNotFound } from '@mechane/protocol';
import type { OperationName } from '@mechane/protocol';
import { Effect, Option, Record } from 'effect';
import type { RawPathParams } from '../types.ts';
import { matchPath } from './match-path.ts';

type FindRouteInput = { readonly method: string; readonly pathname: string };

/** The operation that serves a request, and the path parameters its path names. */
type RouteMatch = { readonly name: OperationName; readonly params: RawPathParams };

/** Finds the catalog operation that serves `method` on `pathname`. */
export const findRoute = Effect.fn('findRoute')(function* ({
  method,
  pathname,
}: FindRouteInput): Effect.fn.Return<RouteMatch, RouteNotFound> {
  for (const name of Record.keys(catalog)) {
    const operation = catalog[name];
    const params = matchPath({ pattern: operation.path, pathname });

    if (operation.method === method && Option.isSome(params)) {
      return { name, params: params.value };
    }
  }

  return yield* new RouteNotFound({ method, path: pathname });
});
