import { readJsonc } from '@mechane/wrangler';
import { Effect } from 'effect';
import type { Schema } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';

type DocumentInput<S extends Schema.Codec<unknown, unknown>> = { readonly path: string; readonly schema: S };

/** Decodes artifact metadata with undeclared fields refused. */
export const readDocument = Effect.fn('readDocument')(function* <S extends Schema.Codec<unknown, unknown>>({
  path,
  schema,
}: DocumentInput<S>): Effect.fn.Return<S['Type'], DistributionFailed, S['DecodingServices']> {
  return yield* readJsonc({
    path,
    schema,
    options: { onExcessProperty: 'error' },
    step: DistributionStep.Read,
    failure: DistributionFailed,
  });
});
