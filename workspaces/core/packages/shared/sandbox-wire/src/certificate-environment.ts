import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Schema } from 'effect';

/** Public trust supplied by the installation, bounded before it crosses the container environment. */
const TRUSTED_CERTIFICATES_MAX_CHARS = 64 * BYTES_PER_KIBIBYTE;

const certificateBound = Schema.isMaxLength(TRUSTED_CERTIFICATES_MAX_CHARS);

const certificatePem = Schema.isPattern(
  /^(?:\s*-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*)+$/u,
);

/** A PEM bundle of public certificate authorities, never private keys or tool-selected paths. */
const TrustedCertificatesPem = Schema.String.check(certificateBound, certificatePem);

/** Absence leaves the platform's existing certificate trust unchanged. */
export const TrustedCertificatesVariable = Schema.OptionFromOptionalKey(TrustedCertificatesPem);
