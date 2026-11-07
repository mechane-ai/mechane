import { catalog, RequestInvalid } from '@mechane/protocol';
import { Record } from 'effect';
import type { RouteMatch } from './types.ts';

type RouteInput = { readonly method: string; readonly pathname: string };
type PatternInput = { readonly pattern: string; readonly pathname: string };

function matchPattern({ pattern, pathname }: PatternInput): Readonly<Record<string, string>> | null {
  const expected = pattern.split('/');
  const actual = pathname.split('/');

  if (expected.length !== actual.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (const [index, part] of expected.entries()) {
    const value = actual[index];

    if (value === undefined) {
      return null;
    }

    if (part.startsWith(':')) {
      try {
        params[part.slice(1)] = decodeURIComponent(value);
      } catch {
        throw new RequestInvalid({ reason: 'a path parameter is not valid percent-encoding' });
      }
    } else if (part !== value) {
      return null;
    }
  }

  return params;
}

export function findRoute({ method, pathname }: RouteInput): RouteMatch | null {
  const names = Record.keys(catalog).filter((name) => catalog[name].method === method);

  for (const name of names) {
    const operation = catalog[name];

    const params = matchPattern({ pattern: operation.path, pathname });

    if (params !== null) {
      return { name, params };
    }
  }

  return null;
}
