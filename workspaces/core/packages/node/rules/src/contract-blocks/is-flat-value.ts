import { Predicate, Record } from 'effect';

/** A value of a contract's entry. */
type IsFlatValueInput = { readonly value: unknown };

/** Whether a value is a word, a number, a list of them, or a record of them, which a sentence can state. */
export function isFlatValue({ value }: IsFlatValueInput): boolean {
  if (Array.isArray(value)) {
    return value.every(Predicate.not(Predicate.isObject));
  }

  if (Predicate.isObject(value)) {
    return Record.values(value).every(Predicate.not(Predicate.isObject));
  }

  return true;
}
