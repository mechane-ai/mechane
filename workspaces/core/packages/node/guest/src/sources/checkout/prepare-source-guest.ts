import { SourceCheckout } from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import { SourceGuestFailed } from '../../errors.ts';
import type { GuestSettings, SourceRequest } from '../../types.ts';
import { readSourceBody } from '../journal/read-source-body.ts';
import { requireSourceGuest } from './require-source-guest.ts';

/** A preparation request carries no credential, so trust can be checked before token delivery. */
type PrepareSourceGuestInput = SourceRequest & { readonly settings: GuestSettings };

const SourceCheckoutBody = Schema.fromJsonString(SourceCheckout);

/** Checks the requested generation and repository before the journal establishes its guest fence. */
export const prepareSourceGuest = Effect.fn('prepareSourceGuest')(function* ({
  ...input
}: PrepareSourceGuestInput): Effect.fn.Return<void, SourceGuestFailed> {
  const { sourceId, generation } = input;
  const body = yield* readSourceBody(input);

  const checkout = yield* Schema.decodeUnknownEffect(SourceCheckoutBody)(body).pipe(
    Effect.mapError(() => new SourceGuestFailed({ sourceId, reason: 'source checkout request is invalid' })),
  );

  if (checkout.sourceId !== sourceId || checkout.generation !== generation) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'source checkout identity differs' });
  }

  yield* requireSourceGuest({
    sourceId,
    repositoryUrl: checkout.repositoryUrl,
    scope: input.settings.scope,
    reason: 'private source checkout requires a fresh trusted guest before credential delivery',
  });
});
