import { HttpHeader, HttpMethod } from '@mechane/records';
import { startHttpService } from '@mechane/stack';

type CancellationGateInput = { readonly origin: URL; readonly path: string };

export type CancellationGate = {
  readonly origin: URL;
  readonly close: () => Promise<void>;
  readonly release: () => void;
  readonly readRequestCount: () => number;
};

export async function startCancellationGate({ origin, path }: CancellationGateInput): Promise<CancellationGate> {
  const gate = Promise.withResolvers<void>();
  let requestCount = 0;

  const service = await startHttpService(async (request) => {
    const url = new URL(request.url);

    if (request.method === HttpMethod.Post && url.pathname === path) {
      requestCount += 1;

      await gate.promise;
    }

    const forwarded = new Request(new URL(`${url.pathname}${url.search}`, origin), request);

    forwarded.headers.delete(HttpHeader.Host);

    return await fetch(forwarded, { redirect: 'manual' });
  });

  return { ...service, release: () => gate.resolve(), readRequestCount: () => requestCount };
}
