import type { Unit } from '@mechane/modules';

type ValueNamesInput = { readonly unit: Unit };

/** The names a value unit's text reads as values; a type reads none at run time. */
export function valueNames({ unit }: ValueNamesInput): ReadonlySet<string> {
  if (unit.isTypeOnly) {
    return new Set();
  }

  return new Set(unit.references.filter(({ isType }) => !isType).map(({ name }) => name));
}
