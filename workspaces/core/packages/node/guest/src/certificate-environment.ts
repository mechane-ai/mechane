import { GATEWAY_CERTIFICATE } from '@mechane/sandbox-wire';
import { Duration, Effect, Option, Record } from 'effect';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
  'NIX_SSL_CERT_FILE',
] as const;

const CERTIFICATE_MODE = 0o600;
const CERTIFICATE_TIMEOUT = Duration.seconds(5);
const CERTIFICATE_TIMEOUT_MS = Duration.toMillis(CERTIFICATE_TIMEOUT);
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
  const javaTrustFile = join(scratchDirectory, 'trusted-certificates.p12');
  const staged = join(scratchDirectory, 'trusted-certificates.pending');
  const javaStaged = join(scratchDirectory, 'trusted-certificates.p12.pending');

  if (!existsSync(javaTrustFile) || !existsSync(certificateFile) || readFileSync(certificateFile, 'utf8') !== content) {
    writeFileSync(staged, content, { mode: CERTIFICATE_MODE });
    execFileSync(
      'openssl',
      [
        'pkcs12',
        '-export',
        '-nokeys',
        '-jdktrust',
        'anyExtendedKeyUsage',
        '-in',
        staged,
        '-out',
        javaStaged,
        '-passout',
        'pass:changeit',
      ],
      { timeout: CERTIFICATE_TIMEOUT_MS, stdio: 'pipe' },
    );
    chmodSync(javaStaged, CERTIFICATE_MODE);
    renameSync(javaStaged, javaTrustFile);
    renameSync(staged, certificateFile);
  }

  const certificate: (name: string) => readonly [string, string] = (name) => [name, certificateFile];
  const entries = CERTIFICATE_VARIABLES.map(certificate);

  return {
    ...Record.fromEntries(entries),
    JAVA_TOOL_OPTIONS: `"-Djavax.net.ssl.trustStore=${javaTrustFile}" -Djavax.net.ssl.trustStoreType=PKCS12 -Djavax.net.ssl.trustStorePassword=changeit`,
  };
}

function readGatewayCertificate(): string {
  if (!existsSync(GATEWAY_CERTIFICATE)) {
    return '';
  }

  return readFileSync(GATEWAY_CERTIFICATE, 'utf8');
}
