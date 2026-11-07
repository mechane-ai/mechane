import { HttpHeader } from '@mechane/records';
import { runtimeHeaders, runtimeOrigin, sandboxRuntimeSettings } from '@mechane/sandbox';
import type { ServiceEnvironment } from './settings.ts';

type ProxyInput = { readonly request: Request; readonly environment: ServiceEnvironment };

const FORWARDED_HEADERS: ReadonlyArray<string> = [
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
];

export async function proxyRuntime({ request, environment }: ProxyInput): Promise<Response> {
  const incoming = new URL(request.url);
  const settings = sandboxRuntimeSettings({ environment });
  const destination = runtimeOrigin({ settings });

  destination.pathname = incoming.pathname;
  destination.search = incoming.search;

  const transport = await runtimeHeaders({ settings });
  const forwarded = new Request(destination, request);

  for (const header of FORWARDED_HEADERS) {
    forwarded.headers.delete(header);
  }

  forwarded.headers.delete(HttpHeader.Host);
  forwarded.headers.delete(HttpHeader.MechaneClientAddress);

  for (const [name, value] of transport.entries()) {
    forwarded.headers.set(name, value);
  }

  const clientAddress = request.headers.get(HttpHeader.ConnectingIp);

  if (clientAddress !== null) {
    forwarded.headers.set(HttpHeader.MechaneClientAddress, clientAddress);
  }

  return await fetch(forwarded, { redirect: 'manual' });
}
