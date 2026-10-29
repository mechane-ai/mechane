import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { Response } from 'miniflare';
import type { TensorlakeFixture } from './types.ts';

/** A suspended VM fixture can return a redirect to verify credential containment. */
export function tensorlakeFixture(): TensorlakeFixture {
  const state = { isRedirecting: false, requests: new Array<string>() };

  const redirect: TensorlakeFixture['redirect'] = () => {
    state.isRedirecting = true;
  };

  const requests: TensorlakeFixture['requests'] = () => [...state.requests];

  const observe: TensorlakeFixture['observe'] = (request) => {
    state.requests.push(request.url);
  };

  const inspect: TensorlakeFixture['inspect'] = (request) => {
    const url = new URL(request.url);

    if (state.isRedirecting) {
      return new Response(null, {
        status: HttpStatusCode.Found,
        headers: { Location: 'https://unexpected.invalid/credential-trap' },
      });
    }

    if (request.method !== HttpMethod.Get || !url.pathname.startsWith('/sandboxes/')) {
      return new Response(null, { status: HttpStatusCode.NotFound });
    }

    return Response.json({
      id: 'fixture-existing',
      image: 'fixture-previous-image',
      status: 'suspended',
      sandbox_url: 'https://fixture.sandbox.tensorlake.ai',
    });
  };

  return { redirect, requests, observe, inspect };
}
