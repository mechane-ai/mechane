import { HttpMethod, HttpStatusCode } from '@mechane/records';
import type { LocalStack } from '@mechane/stack';
import { waitFor } from '../wait-for.ts';

type CommandGateRequest = { readonly method: string; readonly pathname: string };
type RequestCount = { readonly count: number };

export type CommandGate = {
  readonly url: string;
  readonly waitForRequest: (input: RequestCount) => Promise<void>;
  readonly readRequests: () => ReadonlyArray<CommandGateRequest>;
  readonly release: () => void;
  readonly close: () => Promise<void>;
};

export async function startCommandGate({ stack }: { readonly stack: LocalStack }): Promise<CommandGate> {
  const requests: Array<CommandGateRequest> = [];
  const gate = Promise.withResolvers<void>();

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== HttpMethod.Get) {
      return new Response(null, { status: HttpStatusCode.NotFound });
    }

    requests.push({ method: request.method, pathname: url.pathname });
    await gate.promise;

    return new Response(null, { status: HttpStatusCode.Ok });
  }

  const service = stack.registerGuestFixture(handle);

  async function waitForRequest({ count }: RequestCount): Promise<void> {
    await waitFor({
      name: `the guest command to reach ${count} HTTP requests`,
      read: async () => requests.length,
      accept: (observed) => observed >= count,
    });
  }

  return {
    url: service.url.href,
    waitForRequest,
    readRequests: () => structuredClone(requests),
    release: () => gate.resolve(),
    close: async () => {
      gate.resolve();
      await service.close();
    },
  };
}
