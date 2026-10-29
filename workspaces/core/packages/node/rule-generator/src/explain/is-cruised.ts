import type { CruiserRule } from '@mechane/rule-shapes';
import { Predicate } from 'effect';
import { LINTED_FILE } from './constants.ts';

/** A cruiser rule, and a path relative to the workspace. */
type IsCruisedInput = { readonly rule: CruiserRule; readonly path: string };

/** Whether a cruiser rule reaches the path: it is a script whose path the rule's `from` pattern matches. */
export function isCruised({ rule, path }: IsCruisedInput): boolean {
  const starts = [rule.from['path']].filter(Predicate.isString).map((pattern) => new RegExp(pattern));

  return LINTED_FILE.test(path) && starts.every((start) => start.test(path));
}
