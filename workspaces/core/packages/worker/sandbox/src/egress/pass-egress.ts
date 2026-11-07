import { OriginProtocol, SandboxWebAccess } from '@mechane/deployment';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { Option } from 'effect';
import { readEgressDestination } from './read-egress-destination.ts';
import type { EgressVariables } from './schemas.ts';

type PassEgressInput = { readonly request: Request; readonly settings: EgressVariables };

/** Redirects return to the caller, so their destinations pass admission again without forwarding credentials. */
export async function passEgress({ request, settings }: PassEgressInput): Promise<Response> {
  const destination = readEgressDestination({
    request,
    origin: settings.origin,
    runtimeOrigin: settings.runtimeOrigin,
    installationHosts: settings.installationHosts,
    hosts: settings.hosts,
    webAccess: settings.webAccess,
  });

  if (Option.isNone(destination)) {
    const diagnostic = JSON.stringify({ event: 'egress.refused', reason: 'destination' });

    console.log(diagnostic);

    return new Response(null, { status: HttpStatusCode.Forbidden });
  }

  const target = new URL(destination.value.href);

  if (settings.webAccess === SandboxWebAccess.Packages) {
    target.protocol = OriginProtocol.Secure;
  }

  const forwarded = new Request(target, request);

  forwarded.headers.delete(HttpHeader.Host);
  forwarded.headers.delete(HttpHeader.ProxyAuthorization);

  return await fetch(forwarded, { redirect: 'manual' });
}
