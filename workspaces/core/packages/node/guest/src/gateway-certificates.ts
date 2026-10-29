import { Record } from 'effect';
import { existsSync } from 'node:fs';

const GATEWAY_CERTIFICATE = '/etc/cloudflare/certs/cloudflare-containers-ca.crt';

const CERTIFICATE_VARIABLES = [
  'GIT_SSL_CAINFO',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'CURL_CA_BUNDLE',
  'REQUESTS_CA_BUNDLE',
  'PIP_CERT',
] as const;

/** Cloudflare injects its CA after startup, so every child checks the fixed path when it starts. */
export function gatewayCertificates(): Readonly<Record<string, string>> {
  if (!existsSync(GATEWAY_CERTIFICATE)) {
    return {};
  }

  const certificate: (name: string) => readonly [string, string] = (name) => [name, GATEWAY_CERTIFICATE];
  const entries = CERTIFICATE_VARIABLES.map(certificate);

  return Record.fromEntries(entries);
}
