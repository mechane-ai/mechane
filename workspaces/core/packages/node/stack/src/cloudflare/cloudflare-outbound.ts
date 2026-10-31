import { LOOPBACK_HOSTS, OriginProtocol } from '@mechane/deployment';
import { HttpStatusCode } from '@mechane/records';
import { fetch, Response } from 'miniflare';
import type { Request } from 'miniflare';

/** The scripted stack reaches only loopback dependencies, including each launched guest's ephemeral port. */
export function cloudflareOutbound(): (request: Request) => Promise<Response> {
  const outbound: (request: Request) => Promise<Response> = async (request) => {
    const url = new URL(request.url);

    if (url.protocol !== OriginProtocol.Loopback || !LOOPBACK_HOSTS.has(url.hostname)) {
      return new Response(null, { status: HttpStatusCode.Forbidden });
    }

    return await fetch(request, { redirect: 'manual' });
  };

  return outbound;
}
