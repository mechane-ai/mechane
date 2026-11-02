import { RequestInvalid } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { Effect } from 'effect';
import type { AuthenticateInput } from './types.ts';

/** Allows cookie-authenticated writes only from the installation itself. */
export const requireBrowserOrigin = Effect.fn('requireBrowserOrigin')(function* ({
  request,
  settings,
}: AuthenticateInput): Effect.fn.Return<void, RequestInvalid> {
  if (request.headers.get(HttpHeader.Origin) !== settings.origin.origin) {
    return yield* new RequestInvalid({ reason: 'browser writes require the installation origin' });
  }
});
