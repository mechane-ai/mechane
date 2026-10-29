import { localSignInUrl } from '@mechane/protocol';
import { HttpHeader, HttpMethod } from '@mechane/records';
import { Effect } from 'effect';
import { BrowserStep } from '../../constants.ts';
import type { BrowserRefused } from '../../errors.ts';
import { sentPage } from '../sent-page.ts';
import type { Page } from '../types.ts';

type SubmitBootstrapInput = { readonly url: URL; readonly secret: string; readonly origin: string };

/** Posts the bootstrap secret in the form body with an explicit browser origin. */
export const submitBootstrap = Effect.fn('submitBootstrap')(function* ({
  url,
  secret,
  origin,
}: SubmitBootstrapInput): Effect.fn.Return<Page, BrowserRefused> {
  const signIn = localSignInUrl({ origin: url });
  const body = new URLSearchParams({ secret });
  const request = new Request(signIn, { method: HttpMethod.Post, headers: { [HttpHeader.Origin]: origin }, body });

  return yield* sentPage({ step: BrowserStep.SignIn, request });
});
