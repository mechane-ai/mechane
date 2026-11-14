import { Option, Record, Result } from 'effect';
import { catalog } from './catalog.ts';
import type { OperationName } from './catalog.ts';
import { RequestInvalid } from './errors/errors.ts';

/** The catalog operation and decoded path fields, before its request schemas are checked. */
export type RouteMatch = { readonly name: OperationName; readonly params: Readonly<Record<string, string>> };

type RouteInput = { readonly method: string; readonly pathname: string };
type PatternInput = { readonly pattern: string; readonly pathname: string };

function matchPattern({ pattern, pathname }: PatternInput): Option.Option<Readonly<Record<string, string>>> {
  const expected = pattern.split('/');
  const actual = pathname.split('/');

  if (expected.length !== actual.length) {
    return Option.none();
  }

  const params: Record<string, string> = {};

  for (const [index, part] of expected.entries()) {
    const value = Option.fromUndefinedOr(actual[index]);

    if (Option.isNone(value)) {
      return Option.none();
    }

    if (part.startsWith(':')) {
      const decoded = Result.try(() => decodeURIComponent(value.value));

      const checked = Result.mapError(
        decoded,
        () => new RequestInvalid({ reason: 'a path parameter is not valid percent-encoding' }),
      );

      const name = part.slice(1);

      params[name] = Result.getOrThrow(checked);
    } else if (part !== value.value) {
      return Option.none();
    }
  }

  return Option.some(params);
}

/** Matches catalog paths without granting access or validating operation fields. */
export function findRoute({ method, pathname }: RouteInput): Option.Option<RouteMatch> {
  const declared = Record.keys(catalog);
  const names = declared.filter((name) => catalog[name].method === method);

  for (const name of names) {
    const operation = catalog[name];

    const params = matchPattern({ pattern: operation.path, pathname });

    if (Option.isSome(params)) {
      return Option.some({ name, params: params.value });
    }
  }

  return Option.none();
}
