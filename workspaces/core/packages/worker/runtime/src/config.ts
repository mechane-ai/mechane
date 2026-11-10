import type { CredentialKeyring } from '@mechane/control-store';
import { RecordId, SHA256_PATTERN } from '@mechane/records';
import { Predicate, Record, Redacted, Schema } from 'effect';

const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0));
const NonnegativeInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const SecretBinding = Schema.Struct({ get: Schema.declare(Predicate.isFunction) });

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
  secretBinding: Schema.String.check(Schema.isPattern(/^[A-Z][A-Z0-9_]+$/u)),
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
  readonly toolOrigin: string;
  readonly model: {
    readonly upstreamUrl: string;
    readonly apiKey: Redacted.Redacted;
    readonly offers: ReadonlyArray<ModelOffer>;
  };
  readonly sandbox: { readonly origin: string; readonly bearer: Redacted.Redacted };
  readonly notificationProducers: ReadonlyArray<NotificationProducer>;
};

export type RuntimeEnvironment = Readonly<Record<string, unknown>>;

const SECRET_SETTINGS = [
  'MECHANE_DATABASE_URL',
  'MECHANE_CREDENTIAL_KEYRING',
  'MECHANE_MODEL_UPSTREAM_KEY',
  'MECHANE_SANDBOX_SERVICE_KEY',
  'MECHANE_GITHUB_CLIENT_SECRET',
] as const;

export async function resolveRuntimeEnvironment({
  environment,
}: {
  readonly environment: RuntimeEnvironment;
}): Promise<RuntimeEnvironment> {
  const resolved: Record<string, unknown> = { ...environment };
  const producerBindings: Array<string> = [];
  const producers = environment['MECHANE_NOTIFICATION_PRODUCERS'];

  if (typeof producers === 'string') {
    const configuration = Schema.decodeUnknownSync(NotificationProducersSchema)(JSON.parse(producers));

    producerBindings.push(...configuration.map((producer) => producer.secretBinding));
  }

  for (const name of [...SECRET_SETTINGS, ...producerBindings]) {
    const binding = environment[name];

    if (Schema.is(SecretBinding)(binding)) {
      const secret: unknown = await Reflect.apply(binding.get, binding, []);
      resolved[name] = Schema.decodeUnknownSync(Schema.String)(secret);
    }
  }

  return resolved;
}

function requiredEnvironment(environment: RuntimeEnvironment, name: string): string {
  const value = environment[name];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing runtime setting ${name}`);
  }

  return value;
}

function httpOrigin(environment: RuntimeEnvironment, name: string): string {
  const value = requiredEnvironment(environment, name);
  const url = new URL(value);

  if (url.username !== '' || url.password !== '' || !HTTP_PROTOCOLS.has(url.protocol)) {
    throw new Error(`Invalid runtime setting ${name}`);
  }

  if (url.protocol === 'http:' && !LOOPBACK_HOSTNAMES.has(url.hostname)) {
    throw new Error(`Invalid runtime setting ${name}`);
  }

  return value.replace(/\/$/u, '');
}

function optionalInteger(environment: RuntimeEnvironment, name: string, defaultValue: number): number {
  const value = environment[name];

  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid runtime setting ${name}`);
  }

  return parsed;
}

export function loadRuntimeConfiguration({
  environment = process.env,
}: { readonly environment?: RuntimeEnvironment } = {}): RuntimeConfiguration {
  const offers = Schema.decodeUnknownSync(OffersSchema)(
    JSON.parse(requiredEnvironment(environment, 'MECHANE_MODEL_OFFERS')),
  );

  const modelIds = new Set(offers.map((offer) => offer.id));

  const defaultModel = Schema.decodeUnknownSync(Schema.String)(
    environment['MECHANE_DEFAULT_MODEL'] ?? 'openai/gpt-6.1-sol',
  );

  if (modelIds.size !== offers.length || !modelIds.has(defaultModel)) {
    throw new Error('Model offers must have distinct IDs and include the default model');
  }

  const keyring = parseKeyring(environment);

  if (!Object.hasOwn(keyring.keys, keyring.current)) {
    throw new Error('Credential keyring lacks its current key');
  }

  for (const key of Record.values(keyring.keys)) {
    if (!SHA256_PATTERN.test(key.toLowerCase())) {
      throw new Error('Credential keyring contains an invalid key');
    }
  }

  return {
    databaseUrl: Redacted.make(requiredEnvironment(environment, 'MECHANE_DATABASE_URL')),
    credentialKeyring: Redacted.make(keyring),
    maxConnections: optionalInteger(environment, 'MECHANE_DATABASE_MAX_CONNECTIONS', DEFAULT_MAX_CONNECTIONS),
    maxDailyAllowanceMicros: optionalInteger(
      environment,
      'MECHANE_MAX_DAILY_ALLOWANCE_MICROS',
      DEFAULT_DAILY_CAP_MICROS,
    ),
    maxMachines: optionalInteger(environment, 'MECHANE_MAX_MACHINES', DEFAULT_MAX_MACHINES),
    defaultModel,
    publicOrigin: publicOriginSetting(environment),
    toolOrigin: toolOriginSetting(environment),
    githubApiOrigin: Schema.decodeUnknownSync(Schema.String)(
      environment['MECHANE_GITHUB_API_ORIGIN'] ?? 'https://api.github.com',
    ),
    model: {
      upstreamUrl: httpOrigin(environment, 'MECHANE_MODEL_UPSTREAM_URL'),
      apiKey: Redacted.make(requiredEnvironment(environment, 'MECHANE_MODEL_UPSTREAM_KEY')),
      offers,
    },
    sandbox: {
      origin: httpOrigin(environment, 'MECHANE_SANDBOX_ORIGIN'),
      bearer: Redacted.make(requiredEnvironment(environment, 'MECHANE_SANDBOX_SERVICE_KEY')),
    },
    notificationProducers: notificationProducerSettings(environment),
  };
}

function parseKeyring(environment: RuntimeEnvironment): CredentialKeyring {
  try {
    return Schema.decodeUnknownSync(KeyringSchema)(
      JSON.parse(requiredEnvironment(environment, 'MECHANE_CREDENTIAL_KEYRING')),
    );
  } catch {
    throw new Error('Credential keyring configuration is invalid');
  }
}

function notificationProducerSettings(environment: RuntimeEnvironment): ReadonlyArray<NotificationProducer> {
  const raw = environment['MECHANE_NOTIFICATION_PRODUCERS'];

  if (raw === undefined) {
    return [];
  }

  try {
    const producers = Schema.decodeUnknownSync(NotificationProducersSchema, { onExcessProperty: 'error' })(
      JSON.parse(Schema.decodeUnknownSync(Schema.String)(raw)),
    );

    if (new Set(producers.map((producer) => producer.id)).size !== producers.length) {
      throw new Error('Duplicate notification producer');
    }

    return producers.map((producer) => {
      const secret = requiredEnvironment(environment, producer.secretBinding);

      if (secret.length < PRODUCER_SECRET_MIN_CHARS) {
        throw new Error('The producer signing secret is too short');
      }

      return { id: producer.id, recipients: producer.recipients, secret: Redacted.make(secret) };
    });
  } catch {
    throw new Error('Notification producer configuration is invalid');
  }
}

function publicOriginSetting(environment: RuntimeEnvironment): string {
  const value = httpOrigin(environment, 'MECHANE_ORIGIN');
  const url = new URL(value);

  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error('Invalid runtime setting MECHANE_ORIGIN');
  }

  return url.origin;
}

function toolOriginSetting(environment: RuntimeEnvironment): string {
  if (environment['MECHANE_TOOL_ORIGIN'] === undefined) {
    return publicOriginSetting(environment);
  }

  const url = new URL(httpOrigin(environment, 'MECHANE_TOOL_ORIGIN'));

  const hasCredentials = url.username !== '' || url.password !== '';
  const hasDecoratedPath = url.pathname !== '/' || url.search !== '' || url.hash !== '';

  if (url.protocol !== 'https:' || hasCredentials || hasDecoratedPath) {
    throw new Error('Invalid runtime setting MECHANE_TOOL_ORIGIN');
  }

  return url.origin;
}
