import '../../../../licenses/apache-2.0.js';
import '../../../../licenses/effect.js';
import { HttpStatusCode } from '@mechane/records';
import { SANDBOX_SERVICE_PREFIX } from '@mechane/sandbox-wire';
import { proxyRuntime } from './proxy-runtime.ts';
import { serveSandbox } from './serve-sandbox.ts';
import type { ServiceEnvironment } from './settings.ts';

export { EgressGateway, SandboxObject } from '@mechane/sandbox';

const service: Readonly<ExportedHandler<ServiceEnvironment>> = {
  async fetch(request, environment): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith(sandboxRoutePath())) {
        return await serveSandbox({ request, environment });
      }

      return await proxyRuntime({ request, environment });
    } catch {
      console.error('Sandbox service request failed');

      return Response.json({ error: 'ServiceUnavailable' }, { status: HttpStatusCode.Unavailable });
    }
  },
};

function sandboxRoutePath(): string {
  return `${SANDBOX_SERVICE_PREFIX}/`;
}

export default service;
