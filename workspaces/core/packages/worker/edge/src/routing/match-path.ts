import { Array, Option, Record } from 'effect';
import type { RawPathParams } from '../types.ts';

type MatchPathInput = { readonly pattern: string; readonly pathname: string };

/** A segment of an operation's path, and the request path's segment at its place. */
type SegmentPair = readonly [string, string];

/** What separates the segments of a path. */
const PATH_SEPARATOR = '/';

/** What a segment of an operation's path that names a parameter starts with, such as `:mechId`. */
const PARAMETER_PREFIX = ':';

/** Matches `pathname` against an operation's path, whose `:name` segments match any one segment. */
export function matchPath({ pattern, pathname }: MatchPathInput): Option.Option<RawPathParams> {
  const expected = pattern.split(PATH_SEPARATOR);
  const actual = pathname.split(PATH_SEPARATOR);

  if (expected.length !== actual.length) {
    return Option.none();
  }

  const pairs = Array.zip(expected, actual);

  const isMismatched: (pair: SegmentPair) => boolean = ([segment, value]) =>
    !segment.startsWith(PARAMETER_PREFIX) && segment !== value;

  if (pairs.some(isMismatched)) {
    return Option.none();
  }

  const parameters = pairs.filter(([segment]) => segment.startsWith(PARAMETER_PREFIX));

  const parameterEntry: (pair: SegmentPair) => SegmentPair = ([segment, value]) => [
    segment.slice(PARAMETER_PREFIX.length),
    value,
  ];

  return Option.some(Record.fromEntries(parameters.map(parameterEntry)));
}
