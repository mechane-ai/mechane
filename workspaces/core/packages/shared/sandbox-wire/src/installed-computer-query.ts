import { RecordId } from '@mechane/records';
import { Option, Predicate, Schema } from 'effect';

type ComputerQuery = { readonly resource: string; readonly query: URLSearchParams };

const CURSOR_FIELDS: ReadonlyMap<string, ReadonlyArray<string>> = new Map([
  ['completions', ['after']],
  ['evidence', ['after', 'turn_id']],
]);

export function installedComputerQuery({ resource, query }: ComputerQuery): Option.Option<string> {
  if (query.size === 0) {
    return Option.some('');
  }

  const fields = CURSOR_FIELDS.get(resource);

  if (Predicate.isUndefined(fields) || query.size > fields.length) {
    return Option.none();
  }

  const entries = [...query];

  const valid = entries.every(
    ([name, value]) => fields.includes(name) && query.getAll(name).length === 1 && Schema.is(RecordId)(value),
  );

  if (!valid) {
    return Option.none();
  }

  const sorted = entries.toSorted(([left], [right]) => left.localeCompare(right));
  const normalized = new URLSearchParams(sorted).toString();

  return Option.some(normalized);
}
