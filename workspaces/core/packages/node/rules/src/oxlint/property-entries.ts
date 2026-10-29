import type { RestrictedRule } from '@mechane/rule-shapes';
import { Record } from 'effect';
import type { RestrictedProperty } from './types.ts';

type PropertyEntriesInput = { readonly rule: RestrictedRule };

/** A restricted rule's banned properties: each property of each object, with the rule's message. */
export function propertyEntries({ rule }: PropertyEntriesInput): ReadonlyArray<RestrictedProperty> {
  const message = `${rule.message} (${rule.standard})`;

  const objectProperties: (entry: readonly [string, ReadonlyArray<string>]) => ReadonlyArray<RestrictedProperty> = ([
    object,
    names,
  ]) => names.map((property) => ({ object, property, message }));

  return Record.toEntries(rule.properties).flatMap(objectProperties);
}
