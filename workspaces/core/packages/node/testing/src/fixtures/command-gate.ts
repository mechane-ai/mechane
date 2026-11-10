import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { guestFixtureUrl, startHttpService } from '@mechane/stack';
import { randomUUID } from 'node:crypto';
import { waitFor } from '../wait-for.ts';

type CommandGateRequest = { readonly method: string; readonly pathname: string };
type RequestCount = { readonly count: number };
type CommandGateAddress = { readonly gateId: string };

export type CommandGate = {
  readonly url: string;
  readonly waitForRequest: (input: RequestCount) => Promise<void>;
  readonly readRequests: () => ReadonlyArray<CommandGateRequest>;
  readonly release: () => void;
  readonly close: () => Promise<void>;
};

export async function startCommandGate(): Promise<CommandGate> {
  const pathname = commandGatePath({ gateId: randomUUID() });
  const requests: Array<CommandGateRequest> = [];
  const gate = Promise.withResolvers<void>();

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== HttpMethod.Get || url.pathname !== pathname) {
      return new Response(null, { status: HttpStatusCode.NotFound });
    }

    requests.push({ method: request.method, pathname: url.pathname });
    await gate.promise;

    return new Response(null, { status: HttpStatusCode.Ok });
  }

  const service = await startHttpService(handle);
  const address = guestFixtureUrl(new URL(pathname, service.origin));

  async function waitForRequest({ count }: RequestCount): Promise<void> {
    await waitFor({
      name: `the guest command to reach ${count} HTTP requests`,
      read: async () => requests.length,
      accept: (observed) => observed >= count,
    });
  }

  return {
    url: address.href,
    waitForRequest,
    readRequests: () => structuredClone(requests),
    release: () => gate.resolve(),
    close: async () => {
      gate.resolve();
      await service.close();
    },
  };
}

function commandGatePath({ gateId }: CommandGateAddress): string {
  return `/commands/${encodeURIComponent(gateId)}`;
}
