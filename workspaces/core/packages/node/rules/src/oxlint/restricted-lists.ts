import { Severity } from '@mechane/rule-shapes';
import type { RestrictedRule } from '@mechane/rule-shapes';
import { Record } from 'effect';
import { RestrictedKey } from './constants.ts';
import { restrictedEntries } from './restricted-entries.ts';

type RestrictedListsInput = {
  readonly restricted: ReadonlyArray<RestrictedRule>;
  readonly keys: ReadonlyArray<RestrictedKey>;
};

/** The `keys` of the restricted rules, each entry's message ending with the rule of the standard it serves. */
export function restrictedLists({ restricted, keys }: RestrictedListsInput): Readonly<Record<string, unknown>> {
  const { imports, properties } = restrictedEntries({ rules: restricted });

  const entries = {
    [RestrictedKey.Imports]: [Severity.Error, { paths: imports }],
    [RestrictedKey.Properties]: [Severity.Error, ...properties],
  };

  return Record.fromEntries(keys.map((key) => [key, entries[key]]));
}
