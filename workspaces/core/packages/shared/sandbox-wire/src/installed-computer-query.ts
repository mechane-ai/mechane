import { RecordId } from '@mechane/records';
import { Option, Predicate, Record, Result, Schema } from 'effect';
import { EvidenceQuery } from './evidence-query.ts';

type ComputerQuery = { readonly resource: string; readonly query: URLSearchParams };

const completionQuery = Schema.Struct({ after: Schema.optionalKey(RecordId) });
const decodeCompletions = Schema.decodeUnknownResult(completionQuery, { onExcessProperty: 'error' });
const decodeEvidence = Schema.decodeUnknownResult(EvidenceQuery, { onExcessProperty: 'error' });
type QueryDecoder = typeof decodeCompletions | typeof decodeEvidence;

const queryDecoders: ReadonlyMap<string, QueryDecoder> = new Map<string, QueryDecoder>([
  ['completions', decodeCompletions],
  ['evidence', decodeEvidence],
]);

export function installedComputerQuery({ resource, query }: ComputerQuery): Option.Option<string> {
  if (query.size === 0) {
    return Option.some('');
  }

  const decode = queryDecoders.get(resource);
  const entries = [...query];
  const fields = Record.fromEntries(entries);

  if (Predicate.isUndefined(decode) || Record.size(fields) !== query.size) {
    return Option.none();
  }

  const decoded: Result.Result<unknown, unknown> = decode(fields);

  if (Result.isFailure(decoded)) {
    return Option.none();
  }

  const sorted = entries.toSorted(([left], [right]) => left.localeCompare(right));
  const normalized = new URLSearchParams(sorted).toString();

  return Option.some(normalized);
}
