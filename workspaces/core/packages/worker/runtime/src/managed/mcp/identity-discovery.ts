import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { ManagedIdentitySettings } from './identity-settings.ts';

const KEY_PATH = '/.well-known/jwks.json';
const METADATA_PATH = '/.well-known/openid-configuration';

const DISCOVERY_PATHS: ReadonlySet<string> = new Set([KEY_PATH, METADATA_PATH]);
const DISCOVERY_METHODS: ReadonlySet<string> = new Set([HttpMethod.Get, HttpMethod.Head]);

type DiscoveryRequest = { readonly request: Request; readonly configuration: ManagedIdentitySettings | null };

export function managedIdentityDiscovery({ request, configuration }: DiscoveryRequest): Response | null {
  if (configuration === null) {
    return null;
  }

  const url = new URL(request.url);

  if (url.origin !== configuration.issuer || !DISCOVERY_PATHS.has(url.pathname)) {
    return null;
  }

  if (!DISCOVERY_METHODS.has(request.method)) {
    return new Response(null, {
      status: HttpStatusCode.MethodNotAllowed,
      headers: { Allow: Array.from(DISCOVERY_METHODS).join(', ') },
    });
  }

  const headers = { [HttpHeader.ContentType]: MediaType.Json, [HttpHeader.CacheControl]: 'public, max-age=60' };

  if (request.method === HttpMethod.Head) {
    return new Response(null, { headers });
  }

  if (url.pathname === KEY_PATH) {
    return Response.json({ keys: configuration.keys }, { headers });
  }

  return Response.json({ issuer: configuration.issuer, jwks_uri: configuration.issuer + KEY_PATH }, { headers });
}
