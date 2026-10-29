import { OriginProtocol } from '@mechane/deployment';
import { writeLog } from '@mechane/logs';
import { LogEvent } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { Option } from 'effect';
import { readEgressDestination } from './read-egress-destination.ts';
import type { EgressVariables } from './schemas.ts';

type PassEgressInput = { readonly request: Request; readonly settings: EgressVariables };

/** Every upstream uses TLS; redirects return to the caller without forwarding its credentials to another host. */
export async function passEgress({ request, settings }: PassEgressInput): Promise<Response> {
  const destination = readEgressDestination({ request, origin: settings.origin });

  if (Option.isNone(destination)) {
    writeLog({ line: { event: LogEvent.EgressRefused, reason: 'destination' } });

    return new Response(null, { status: HttpStatusCode.Forbidden });
  }

  const target = new URL(destination.value.href);

  target.protocol = OriginProtocol.Secure;

  const forwarded = new Request(target, request);

  forwarded.headers.delete(HttpHeader.Host);
  forwarded.headers.delete(HttpHeader.ProxyAuthorization);

  return await fetch(forwarded, { redirect: 'manual' });
}
