import { sha256Hex } from '@mechane/program';
import { Order, Record, Schema } from 'effect';
import type { Json } from './application-types.ts';

type JsonDigestInput = { readonly value: Json };

const JsonFields = Schema.Record(Schema.String, Schema.Json);

/** Canonical key order keeps retry identities stable across equivalent JSON encodings. */
export function jsonDigest({ value }: JsonDigestInput): string {
  const contents = JSON.stringify(value, (_key, member: unknown) => {
    if (!Schema.is(JsonFields)(member)) {
      return member;
    }

    const entries = Record.toEntries(member).toSorted(([left], [right]) => Order.String(left, right));

    return Record.fromEntries(entries);
  });

  return sha256Hex({ contents });
}
