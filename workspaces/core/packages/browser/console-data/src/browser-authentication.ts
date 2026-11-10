import { BROWSER_AUTHENTICATION_REQUEST, BrowserAuthenticationPath } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Duration, Schema } from 'effect';
import { invalidateBrowserSession } from './scope-invalidation.ts';

const AUTHENTICATION_LOCK = 'mechane:browser-authentication';
const SIGN_OUT_MESSAGE = 'sign-out';
const AUTHENTICATION_TIMEOUT = Duration.minutes(1);

const AUTHENTICATION_PATHS: ReadonlySet<string> = new Set([
  BrowserAuthenticationPath.SignIn,
  BrowserAuthenticationPath.Callback,
  BrowserAuthenticationPath.SignOut,
]);

class BrowserAuthenticationFailed extends Schema.TaggedError<BrowserAuthenticationFailed>()(
  'BrowserAuthenticationFailed',
  { reason: Schema.String },
) {}

type BrowserAuthenticationInput = { readonly url: URL; readonly signal: AbortSignal };

async function exchange({ url, signal }: BrowserAuthenticationInput): Promise<Response> {
  const queued = new AbortController();
  const operation: { hasStarted: boolean; channel?: BroadcastChannel } = { hasStarted: false };

  try {
    const channel = new BroadcastChannel(AUTHENTICATION_LOCK);
    const isSigningOut = url.pathname === BrowserAuthenticationPath.SignOut;

    operation.channel = channel;

    if (!isSigningOut) {
      channel.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (event.data === SIGN_OUT_MESSAGE && !operation.hasStarted) {
          queued.abort();
        }
      });
    }

    if (isSigningOut) {
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel takes one argument.
      channel.postMessage(SIGN_OUT_MESSAGE);
    }

    const queueSignal = AbortSignal.any([signal, queued.signal]);

    return await navigator.locks.request(AUTHENTICATION_LOCK, { signal: queueSignal }, async () => {
      operation.hasStarted = true;

      const timeoutMs = Duration.toMillis(AUTHENTICATION_TIMEOUT);
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);

      const response = await fetch(url, {
        method: HttpMethod.Post,
        headers: { [HttpHeader.BrowserAuthentication]: BROWSER_AUTHENTICATION_REQUEST },
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        signal: requestSignal,
      });

      if (isSigningOut || (url.pathname === BrowserAuthenticationPath.Callback && response.ok)) {
        invalidateBrowserSession({ origin: url.origin });
      }

      return response;
    });
  } catch {
    if (queued.signal.aborted) {
      throw new BrowserAuthenticationFailed({ reason: 'Sign-in was cancelled by sign-out; start again to sign in' });
    }

    throw new BrowserAuthenticationFailed({ reason: 'Authentication could not complete; try again' });
  } finally {
    operation.channel?.close();
  }
}

export async function completeBrowserAuthentication({ url, signal }: BrowserAuthenticationInput): Promise<URL> {
  signal.throwIfAborted();

  if (!('locks' in navigator) || typeof BroadcastChannel !== 'function') {
    throw new BrowserAuthenticationFailed({ reason: 'Authentication requires a browser that supports Web Locks' });
  }

  if (url.origin !== globalThis.location.origin || !AUTHENTICATION_PATHS.has(url.pathname)) {
    throw new BrowserAuthenticationFailed({ reason: 'Authentication must use this installation’s sign-in pages' });
  }

  const response = await exchange({ url, signal });

  if (!response.ok) {
    const content = await response.text();
    const page = new DOMParser().parseFromString(content, MediaType.HtmlDocument);
    const reason = page.querySelector('main p')?.textContent ?? 'Authentication could not complete; try again';

    throw new BrowserAuthenticationFailed({ reason });
  }

  const location = response.headers.get(HttpHeader.Location);

  await response.body?.cancel();

  if (location === null) {
    throw new BrowserAuthenticationFailed({ reason: 'Authentication did not return a destination; try again' });
  }

  const destination = new URL(location, url);

  if (url.pathname !== BrowserAuthenticationPath.SignIn && destination.origin !== url.origin) {
    throw new BrowserAuthenticationFailed({
      reason: 'Authentication returned a destination outside this installation',
    });
  }

  return destination;
}

type BrowserAuthenticationMessageInput = { readonly failure: unknown };

export function browserAuthenticationMessage({ failure }: BrowserAuthenticationMessageInput): string {
  if (Schema.is(BrowserAuthenticationFailed)(failure)) {
    return failure.reason;
  }

  return 'Authentication could not complete; try again';
}
