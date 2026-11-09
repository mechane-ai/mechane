import { RecordId, SHA256_PATTERN } from '@mechane/records';
import { Record, Redacted, Schema } from 'effect';
import type { CredentialKeyring } from './domain.ts';

const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0));
const NonnegativeInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const ModelOfferSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  contextWindowTokens: PositiveInteger,
  maxOutputTokens: PositiveInteger,
  inputMicrosPerMillionTokens: NonnegativeInteger,
  outputMicrosPerMillionTokens: NonnegativeInteger,
  cacheReadMicrosPerMillionTokens: NonnegativeInteger,
  cacheWriteMicrosPerMillionTokens: NonnegativeInteger,
  supportsImages: Schema.optionalKey(Schema.Boolean),
});

const KeyringSchema = Schema.Struct({
  current: Schema.NonEmptyString,
  keys: Schema.Record(Schema.NonEmptyString, Schema.String),
});

const OffersSchema = Schema.NonEmptyArray(ModelOfferSchema);
const PRODUCER_SECRET_MIN_CHARS = 32;

const NotificationProducerSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  secret: Schema.String.check(Schema.isMinLength(PRODUCER_SECRET_MIN_CHARS)),
  recipients: Schema.NonEmptyArray(Schema.Struct({ workspaceId: RecordId, mechId: RecordId })),
});

const NotificationProducersSchema = Schema.Array(NotificationProducerSchema);
const DEFAULT_MAX_CONNECTIONS = 4;
const DEFAULT_DAILY_CAP_MICROS = 50_000_000;
const DEFAULT_MAX_MACHINES = 10;
const HTTP_PROTOCOLS: ReadonlySet<string> = new Set(['https:', 'http:']);
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

export type ModelOffer = typeof ModelOfferSchema.Type;

export type NotificationProducer = {
  readonly id: string;
  readonly secret: Redacted.Redacted;
  readonly recipients: ReadonlyArray<{ readonly workspaceId: string; readonly mechId: string }>;
};

export type RuntimeConfiguration = {
  readonly databaseUrl: Redacted.Redacted;
  readonly credentialKeyring: Redacted.Redacted<CredentialKeyring>;
  readonly maxConnections: number;
  readonly maxDailyAllowanceMicros: number;
  readonly maxMachines: number;
  readonly defaultModel: string;
  readonly githubApiOrigin: string;
  readonly publicOrigin: string;
  readonly model: {
    readonly upstreamUrl: string;
    readonly apiKey: Redacted.Redacted;
    readonly offers: ReadonlyArray<ModelOffer>;
  };
  readonly sandbox: { readonly origin: string; readonly bearer: Redacted.Redacted };
  readonly notificationProducers: ReadonlyArray<NotificationProducer>;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing runtime setting ${name}`);
  }

  return value;
}

function httpOrigin(name: string): string {
  const value = requiredEnvironment(name);
  const url = new URL(value);

  if (url.username !== '' || url.password !== '' || !HTTP_PROTOCOLS.has(url.protocol)) {
    throw new Error(`Invalid runtime setting ${name}`);
  }

  if (url.protocol === 'http:' && !LOOPBACK_HOSTNAMES.has(url.hostname)) {
    throw new Error(`Invalid runtime setting ${name}`);
  }

  return value.replace(/\/$/u, '');
}

function optionalInteger(name: string, defaultValue: number): number {
  const value = process.env[name];

  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid runtime setting ${name}`);
  }

  return parsed;
}

export function loadRuntimeConfiguration(): RuntimeConfiguration {
  const offers = Schema.decodeUnknownSync(OffersSchema)(JSON.parse(requiredEnvironment('MECHANE_MODEL_OFFERS')));
  const modelIds = new Set(offers.map((offer) => offer.id));

  const defaultModel = process.env['MECHANE_DEFAULT_MODEL'] ?? 'openai/gpt-6.1-sol';

  if (modelIds.size !== offers.length || !modelIds.has(defaultModel)) {
    throw new Error('Model offers must have distinct IDs and include the default model');
  }

  const keyring = parseKeyring();

  if (!Object.hasOwn(keyring.keys, keyring.current)) {
    throw new Error('Credential keyring lacks its current key');
  }

  for (const key of Record.values(keyring.keys)) {
    if (!SHA256_PATTERN.test(key.toLowerCase())) {
      throw new Error('Credential keyring contains an invalid key');
    }
  }

  return {
    databaseUrl: Redacted.make(requiredEnvironment('MECHANE_DATABASE_URL')),
    credentialKeyring: Redacted.make(keyring),
    maxConnections: optionalInteger('MECHANE_DATABASE_MAX_CONNECTIONS', DEFAULT_MAX_CONNECTIONS),
    maxDailyAllowanceMicros: optionalInteger('MECHANE_MAX_DAILY_ALLOWANCE_MICROS', DEFAULT_DAILY_CAP_MICROS),
    maxMachines: optionalInteger('MECHANE_MAX_MACHINES', DEFAULT_MAX_MACHINES),
    defaultModel,
    publicOrigin: publicOriginSetting(),
    githubApiOrigin: process.env['MECHANE_GITHUB_API_ORIGIN'] ?? 'https://api.github.com',
    model: {
      upstreamUrl: httpOrigin('MECHANE_MODEL_UPSTREAM_URL'),
      apiKey: Redacted.make(requiredEnvironment('MECHANE_MODEL_UPSTREAM_KEY')),
      offers,
    },
    sandbox: {
      origin: httpOrigin('MECHANE_SANDBOX_ORIGIN'),
      bearer: Redacted.make(requiredEnvironment('MECHANE_SANDBOX_KEY')),
    },
    notificationProducers: notificationProducerSettings(),
  };
}

function parseKeyring(): CredentialKeyring {
  try {
    return Schema.decodeUnknownSync(KeyringSchema)(JSON.parse(requiredEnvironment('MECHANE_CREDENTIAL_KEYRING')));
  } catch {
    throw new Error('Credential keyring configuration is invalid');
  }
}

function notificationProducerSettings(): ReadonlyArray<NotificationProducer> {
  const raw = process.env['MECHANE_NOTIFICATION_PRODUCERS'];

  if (raw === undefined) {
    return [];
  }

  try {
    const producers = Schema.decodeUnknownSync(NotificationProducersSchema, { onExcessProperty: 'error' })(
      JSON.parse(raw),
    );

    if (new Set(producers.map((producer) => producer.id)).size !== producers.length) {
      throw new Error('Duplicate notification producer');
    }

    return producers.map((producer) => ({ ...producer, secret: Redacted.make(producer.secret) }));
  } catch {
    throw new Error('Notification producer configuration is invalid');
  }
}

function publicOriginSetting(): string {
  const value = httpOrigin('MECHANE_PUBLIC_ORIGIN');
  const url = new URL(value);

  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error('Invalid runtime setting MECHANE_PUBLIC_ORIGIN');
  }

  return url.origin;
}
