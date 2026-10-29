import { Effect } from 'effect';
import type { BrowserStep } from '../constants.ts';
import { BrowserRefused } from '../errors.ts';
import type { Page } from './types.ts';

/** A request a step sends. */
type SendInput = { readonly step: BrowserStep; readonly request: Request };

/** Sends one request without following a redirect, and reads the page it answers with, whatever its status. */
export const sentPage = Effect.fn('sentPage')(function* ({
  step,
  request,
}: SendInput): Effect.fn.Return<Page, BrowserRefused> {
  const url = new URL(request.url);

  const response = yield* Effect.tryPromise({
    try: (signal) => fetch(request, { signal, redirect: 'manual' }),
    catch: (cause) => new BrowserRefused({ step, url, reason: String(cause) }),
  });

  const text = yield* Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) => new BrowserRefused({ step, url, reason: String(cause) }),
  });

  return { url, status: response.status, headers: response.headers, text };
});
