import { GATEWAY_CERTIFICATE } from '@mechane/sandbox-wire';
import { Effect, Option, Record } from 'effect';
import { X509Certificate } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';
import { GuestMisconfigured } from './errors.ts';
import type { GuestSettings } from './types.ts';

const CERTIFICATE_VARIABLES = [
  'GIT_SSL_CAINFO',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'CURL_CA_BUNDLE',
  'REQUESTS_CA_BUNDLE',
  'PIP_CERT',
] as const;

const CERTIFICATE_MODE = 0o600;
const PEM_CERTIFICATE = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/gu;

type TrustInput = Pick<GuestSettings, 'scratchDirectory' | 'trustedCertificatesPem'>;
type ValidateTrustInput = Pick<TrustInput, 'trustedCertificatesPem'>;

/** Invalid installation trust fails startup without copying its contents into a diagnostic. */
export const validateTrustedCertificates = Effect.fn('validateTrustedCertificates')(function* ({
  trustedCertificatesPem,
}: ValidateTrustInput): Effect.fn.Return<void, GuestMisconfigured> {
  if (Option.isNone(trustedCertificatesPem)) {
    return;
  }

  const certificates = trustedCertificatesPem.value.matchAll(PEM_CERTIFICATE);

  for (const [certificate] of certificates) {
    const parsed = yield* Effect.try({
      try: () => new X509Certificate(certificate),
      catch: () => new GuestMisconfigured({ reason: 'installation certificate authority bundle is invalid' }),
    });

    if (!parsed.ca) {
      return yield* new GuestMisconfigured({ reason: 'installation trust must contain certificate authorities' });
    }
  }
});

/** Each child picks up a late gateway CA together with installation trust and the runtime's public roots. */
export function certificateEnvironment({
  scratchDirectory,
  trustedCertificatesPem,
}: TrustInput): Readonly<Record<string, string>> {
  const gateway = readGatewayCertificate();

  if (gateway === '' && Option.isNone(trustedCertificatesPem)) {
    return {};
  }

  const additional = Option.getOrElse(trustedCertificatesPem, () => '');
  const content = [...rootCertificates, additional, gateway].join('\n');
  const certificateFile = join(scratchDirectory, 'trusted-certificates.pem');
  const staged = join(scratchDirectory, 'trusted-certificates.pending');

  writeFileSync(staged, content, { mode: CERTIFICATE_MODE });
  renameSync(staged, certificateFile);

  const certificate: (name: string) => readonly [string, string] = (name) => [name, certificateFile];
  const entries = CERTIFICATE_VARIABLES.map(certificate);

  return Record.fromEntries(entries);
}

function readGatewayCertificate(): string {
  if (!existsSync(GATEWAY_CERTIFICATE)) {
    return '';
  }

  return readFileSync(GATEWAY_CERTIFICATE, 'utf8');
}
