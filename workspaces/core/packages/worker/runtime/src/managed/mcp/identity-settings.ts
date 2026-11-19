import { Redacted, Schema } from 'effect';
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

const Audience = Schema.Struct({ audience: Schema.NonEmptyString, urls: Schema.NonEmptyArray(Schema.NonEmptyString) });

const IdentityConfiguration = Schema.Struct({
  issuer: Schema.NonEmptyString,
  audiences: Schema.Array(Audience),
  publishedPublicKeys: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  tokenLifetimeSeconds: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 120, maximum: 900 }))),
  includeActor: Schema.optional(Schema.Boolean),
});

const EXPONENT = 'e';
const MODULUS = 'n';

const PublicRsaKey = Schema.Struct({
  [EXPONENT]: Schema.NonEmptyString,
  kty: Schema.Literal('RSA'),
  [MODULUS]: Schema.NonEmptyString,
});

const MINIMUM_RSA_BITS = 2048;
const DEFAULT_TOKEN_LIFETIME_SECONDS = 300;

export type IdentityPublicKey = typeof PublicRsaKey.Type & {
  readonly kid: string;
  readonly alg: 'RS256';
  readonly use: 'sig';
};

export type ManagedIdentitySettings = {
  readonly issuer: string;
  readonly audiences: ReadonlyArray<typeof Audience.Type>;
  readonly key: Redacted.Redacted<KeyObject>;
  readonly kid: string;
  readonly keys: ReadonlyArray<IdentityPublicKey>;
  readonly tokenLifetimeSeconds: number;
  readonly includeActor: boolean;
};

export function identityHttpsUrl(value: string): URL {
  if (!URL.canParse(value) || /[\\\s]/u.test(value) || /%(?:2f|5c|25)/iu.test(value)) {
    throw new Error('Invalid agent identity URL');
  }

  const url = new URL(value);

  const hasExtraParts = [url.username, url.password, url.search, url.hash].some((part) => part.length > 0);

  if (url.protocol !== 'https:' || hasExtraParts) {
    throw new Error('Invalid agent identity URL');
  }

  return url;
}

function publicKey(key: KeyObject): IdentityPublicKey {
  if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < MINIMUM_RSA_BITS) {
    throw new Error('An RSA signing key of at least 2048 bits is required');
  }

  const fields = Schema.decodeUnknownSync(PublicRsaKey)(key.export({ format: 'jwk' }));
  const canonical = JSON.stringify({ [EXPONENT]: fields[EXPONENT], kty: fields.kty, [MODULUS]: fields[MODULUS] });
  const thumbprint = createHash('sha256').update(canonical).digest('base64url');

  return { ...fields, kid: thumbprint, alg: 'RS256', use: 'sig' };
}

function additionalKey(pem: string): IdentityPublicKey {
  if (!pem.startsWith('-----BEGIN PUBLIC KEY-----')) {
    throw new Error('Expected a public key');
  }

  return publicKey(createPublicKey(pem));
}

function validateAudience(recipient: typeof Audience.Type): string {
  identityHttpsUrl(recipient.audience);

  for (const prefix of recipient.urls) {
    identityHttpsUrl(prefix);
  }

  return recipient.audience;
}

export function readManagedIdentitySettings(
  environment: Readonly<Record<string, unknown>>,
): ManagedIdentitySettings | null {
  const raw = environment['MECHANE_AGENT_IDENTITY'];
  const pem = environment['MECHANE_AGENT_IDENTITY_PRIVATE_KEY_PEM'];

  if (raw === undefined && pem === undefined) {
    return null;
  }

  try {
    if (typeof raw !== 'string' || typeof pem !== 'string') {
      throw new TypeError('Expected identity settings and private key');
    }

    const configuration = Schema.decodeUnknownSync(Schema.fromJsonString(IdentityConfiguration), {
      onExcessProperty: 'error',
    })(raw);

    if (identityHttpsUrl(configuration.issuer).origin !== configuration.issuer) {
      throw new Error('Expected an HTTPS issuer origin');
    }

    const audienceIds = new Set(configuration.audiences.map(validateAudience));

    if (audienceIds.size !== configuration.audiences.length) {
      throw new Error('Duplicate agent identity audience');
    }

    const key = createPrivateKey(pem);
    const signingPublicKey = publicKey(createPublicKey(key));
    const keys = [signingPublicKey, ...(configuration.publishedPublicKeys ?? []).map(additionalKey)];

    if (new Set(keys.map((publicSigningKey) => publicSigningKey.kid)).size !== keys.length) {
      throw new Error('Duplicate agent identity signing key');
    }

    return {
      issuer: configuration.issuer,
      audiences: configuration.audiences,
      key: Redacted.make(key),
      kid: signingPublicKey.kid,
      keys,
      tokenLifetimeSeconds: configuration.tokenLifetimeSeconds ?? DEFAULT_TOKEN_LIFETIME_SECONDS,
      includeActor: configuration.includeActor ?? true,
    };
  } catch {
    throw new Error('Invalid managed agent identity signing configuration');
  }
}
