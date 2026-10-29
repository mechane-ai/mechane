import { HttpStatusCode } from '@mechane/records';
import { fetch, Response } from 'miniflare';
import type { Request } from 'miniflare';
import type { TensorlakeFixture } from './types.ts';

type CloudflareOutboundInput = { readonly origins: ReadonlySet<string>; readonly provider: TensorlakeFixture };
const TENSORLAKE_ORIGIN = 'https://api.tensorlake.ai';

/** Records attempted provider redirects as well as API requests; every other external origin is refused. */
export function cloudflareOutbound({
  origins,
  provider,
}: CloudflareOutboundInput): (request: Request) => Promise<Response> {
  const outbound: (request: Request) => Promise<Response> = async (request) => {
    const url = new URL(request.url);

    if (url.origin === TENSORLAKE_ORIGIN) {
      provider.observe(request);

      return provider.inspect(request);
    }

    if (!origins.has(url.origin)) {
      provider.observe(request);

      return new Response(null, { status: HttpStatusCode.Forbidden });
    }

    return await fetch(request, { redirect: 'manual' });
  };

  return outbound;
}
