import Anthropic from '@anthropic-ai/sdk';
import { BROWSER_AUTHENTICATION_REQUEST } from '@mechane/protocol';
import type { Workspace } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';

type ConsoleManagedInput = {
  readonly origin: URL;
  readonly workspaceId: Workspace['id'];
  readonly signal: AbortSignal;
  readonly onSessionEnded: () => void;
};

/** Binds an admitted Console client to its HttpOnly cookie and workspace for the viewer's lifetime. */
export function createConsoleManagedClient({
  origin,
  workspaceId,
  signal,
  onSessionEnded,
}: ConsoleManagedInput): Anthropic {
  const gateway = new URL('/console-api', origin);

  return new Anthropic({
    baseURL: gateway.href,
    // An explicitly empty credential disables SDK profile lookup. The gateway only authenticates the session cookie.
    authToken: '',
    defaultHeaders: {
      [HttpHeader.Authorization]: null,
      [HttpHeader.BrowserAuthentication]: BROWSER_AUTHENTICATION_REQUEST,
      'anthropic-workspace-id': workspaceId,
    },
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const lifetime = AbortSignal.any([request.signal, signal]);

      const response = await fetch(request, {
        mode: 'same-origin',
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        signal: lifetime,
      });

      if (response.status === HttpStatusCode.Unauthorized && !lifetime.aborted) {
        onSessionEnded();
      }

      return response;
    },
  });
}
