import { GATEWAY_CERTIFICATE, GuestScope } from '@mechane/sandbox-wire';
import { Duration, Effect, Option, Record } from 'effect';
import { execFileSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
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
const BAZEL_RC_FILE = '/run/mechane/bazel.bazelrc';

type TrustInput = Pick<GuestSettings, 'scratchDirectory' | 'trustedCertificatesPem' | 'scope'>;
type ValidateTrustInput = Pick<TrustInput, 'trustedCertificatesPem'>;
type WriteBazelOptionsInput = Pick<TrustInput, 'scope'> & { readonly options: ReadonlyArray<string> };

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
  scope,
}: TrustInput): Readonly<Record<string, string>> {
  const gateway = readGatewayCertificate();

  if (gateway === '' && Option.isNone(trustedCertificatesPem)) {
    writeBazelOptions({ scope, options: [] });

    return {};
  }

  const additional = Option.getOrElse(trustedCertificatesPem, () => '');
  const content = [...rootCertificates, additional, gateway].join('\n');
  const digest = createHash('sha256').update(content).digest('hex');
  const certificateFile = join(scratchDirectory, `trusted-certificates-${digest}.pem`);
  // A new path changes Bazel's startup options, restarting a server that cached the previous authorities.
  const javaTrustFile = join(scratchDirectory, `trusted-certificates-${digest}.p12`);
  const staged = join(scratchDirectory, 'trusted-certificates.pending');
  const javaStaged = join(scratchDirectory, 'trusted-certificates.p12.pending');

  if (!existsSync(javaTrustFile) || !existsSync(certificateFile)) {
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

  const options = [
    `-Djavax.net.ssl.trustStore=${javaTrustFile}`,
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    '-Djavax.net.ssl.trustStorePassword=changeit',
  ];

  writeBazelOptions({ scope, options });

  return {
    ...Record.fromEntries(entries),
    JAVA_TOOL_OPTIONS: options.map((option) => JSON.stringify(option)).join(' '),
  };
}

function writeBazelOptions({ scope, options }: WriteBazelOptionsInput): void {
  if (scope !== GuestScope.Container) {
    return;
  }

  // Bazel discards JAVA_TOOL_OPTIONS before starting its server JVM.
  const lines = options.map((option) => `startup --host_jvm_args=${JSON.stringify(option)}`);
  const content = `${lines.join('\n')}\n`;

  if (existsSync(BAZEL_RC_FILE) && readFileSync(BAZEL_RC_FILE, 'utf8') === content) {
    return;
  }

  const staged = `${BAZEL_RC_FILE}.pending`;

  writeFileSync(staged, content, { mode: CERTIFICATE_MODE });
  renameSync(staged, BAZEL_RC_FILE);
}

function readGatewayCertificate(): string {
  if (!existsSync(GATEWAY_CERTIFICATE)) {
    return '';
  }

  return readFileSync(GATEWAY_CERTIFICATE, 'utf8');
}
