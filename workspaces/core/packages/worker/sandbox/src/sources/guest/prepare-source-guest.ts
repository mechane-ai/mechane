import type { SourceFence } from '@mechane/sandbox-store';
import { SourceCheckout, SourceStep } from '@mechane/sandbox-wire';
import type { SourceGuestAnswer } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import type { FreshSourceMachine } from '../../types.ts';
import { callSourceGuest } from './call-source-guest.ts';

type PrepareSourceGuestInput = { readonly fence: SourceFence; readonly fresh: FreshSourceMachine };

/** The fresh guest receives only checkout intent during preparation; credential delivery is a later transition. */
export async function prepareSourceGuest({ fence, fresh }: PrepareSourceGuestInput): Promise<SourceGuestAnswer> {
  const { sourceId, generation, repositoryUrl, commit } = fence;
  const checkout = { sourceId, generation, repositoryUrl, commit };
  const schema = Schema.fromJsonString(SourceCheckout);
  const encoded = Schema.encodeSync(schema)(checkout);
  const body = Option.some(encoded);

  return await callSourceGuest({ ...checkout, ...fresh, step: SourceStep.Prepare, body });
}
